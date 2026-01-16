import {
  requireOptionalNativeModule,
  EventEmitter,
  NativeModule,
  EventSubscription,
} from "expo-modules-core";

interface NativeLLMModuleInterface extends NativeModule {
  loadModel(params: LoadModelParams): Promise<{ ok: true; engine: string }>;
  unloadModel(): Promise<{ ok: true }>;
  status(): Promise<{ loaded: boolean; engine: string; version: string }>;
  health(): Promise<{ ok: boolean; details: string }>;
  stop(requestId: string): Promise<{ ok: true }>;
  embed(text: string): Promise<{ vector: number[]; dim: number }>;
  generate(params: GenerateParams): Promise<{ requestId: string }>;
}

const NativeModuleInstance =
  requireOptionalNativeModule<NativeLLMModuleInterface>("native-llm");

const createUnavailableError = (method: string) =>
  new Error(
    `[native-llm] "${method}" is unavailable because the native module is not registered on this platform.`,
  );

const UnavailableModule: NativeLLMModuleInterface = {
  addListener: () => {},
  removeListeners: () => {},
  loadModel: async () => Promise.reject(createUnavailableError("loadModel")),
  unloadModel: async () =>
    Promise.reject(createUnavailableError("unloadModel")),
  status: async () => Promise.reject(createUnavailableError("status")),
  health: async () => Promise.reject(createUnavailableError("health")),
  stop: async () => Promise.reject(createUnavailableError("stop")),
  embed: async () => Promise.reject(createUnavailableError("embed")),
  generate: async () => Promise.reject(createUnavailableError("generate")),
};

const NativeModuleProxy = NativeModuleInstance ?? UnavailableModule;

const emitter = NativeModuleInstance
  ? new EventEmitter(NativeModuleInstance as any)
  : null;

export type Subscription = EventSubscription;

export type LLMProgressEvent =
  | { type: "status"; requestId?: string; message: string }
  | { type: "token"; requestId: string; token: string }
  | {
      type: "done";
      requestId: string;
      output: string;
      tokens: number;
      ms: number;
    }
  | { type: "error"; requestId?: string; message: string };

export type GenerateParams = {
  prompt: string;
  maxTokens?: number; // default 256
  temperature?: number; // default 0.8
  topK?: number; // default 40
  seed?: number; // default 0 (random)
};

export type LoadModelParams = {
  modelPath: string; // Path to local model file (GGUF on Android, .mlpackage on iOS)
  profile?: string; // Optional profile tag
  nCtx?: number; // Context size (Android only, default 2048)
  nThreads?: number; // Number of threads (Android only, default 4)
  useGpu?: boolean; // Force GPU usage (default true)
};

export function addLLMListener(
  cb: (e: LLMProgressEvent) => void,
): EventSubscription {
  if (!emitter) {
    console.warn("[native-llm] addLLMListener called without native module.");
    return {
      remove: () => {},
    } as EventSubscription;
  }
  return (emitter as any).addListener("llmEvent", cb);
}

export async function loadModel(
  params: LoadModelParams,
): Promise<{ ok: true; engine: string }> {
  return await NativeModuleProxy.loadModel(params);
}

export async function unloadModel(): Promise<{ ok: true }> {
  return await NativeModuleProxy.unloadModel();
}

export async function status(): Promise<{
  loaded: boolean;
  engine: string;
  version: string;
}> {
  return await NativeModuleProxy.status();
}

export async function health(): Promise<{ ok: boolean; details: string }> {
  return await NativeModuleProxy.health();
}

export async function stop(requestId: string): Promise<{ ok: true }> {
  return await NativeModuleProxy.stop(requestId);
}

export async function embed(
  text: string,
): Promise<{ vector: number[]; dim: number }> {
  return await NativeModuleProxy.embed(text);
}

export async function generate(
  params: GenerateParams,
): Promise<{ requestId: string }> {
  return await NativeModuleProxy.generate(params);
}

export default {
  addLLMListener,
  loadModel,
  unloadModel,
  status,
  health,
  stop,
  embed,
  generate,
};
