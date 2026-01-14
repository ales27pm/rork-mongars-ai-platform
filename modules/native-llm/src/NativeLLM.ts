import { requireNativeModule, EventEmitter, NativeModule } from "expo-modules-core";

interface NativeLLMModuleInterface extends NativeModule {
  loadModel(params: LoadModelParams): Promise<{ ok: true; engine: string }>;
  unloadModel(): Promise<{ ok: true }>;
  status(): Promise<{ loaded: boolean; engine: string; version: string }>;
  health(): Promise<{ ok: boolean; details: string }>;
  stop(requestId: string): Promise<{ ok: true }>;
  embed(text: string): Promise<{ vector: number[]; dim: number }>;
  generate(params: GenerateParams): Promise<{ requestId: string }>;
}

const NativeModuleInstance = requireNativeModule<NativeLLMModuleInterface>("native-llm");
// @ts-ignore: NativeModule vs EventEmitter strictness
const emitter = new EventEmitter(NativeModuleInstance);

export type Subscription = {
  remove: () => void;
};

export type LLMProgressEvent =
  | { type: "status"; requestId?: string; message: string }
  | { type: "token"; requestId: string; token: string }
  | { type: "done"; requestId: string; output: string; tokens: number; ms: number }
  | { type: "error"; requestId?: string; message: string };

export type GenerateParams = {
  prompt: string;
  maxTokens?: number;      // default 256
  temperature?: number;    // default 0.8
  topK?: number;           // default 40
  seed?: number;           // default 0 (random)
};

export type LoadModelParams = {
  modelPath: string;       // Path to local model file (GGUF on Android, .mlpackage on iOS)
  profile?: string;        // Optional profile tag
  nCtx?: number;          // Context size (Android only, default 2048)
  nThreads?: number;      // Number of threads (Android only, default 4)
  useGpu?: boolean;       // Force GPU usage (default true)
};

export function addLLMListener(cb: (e: LLMProgressEvent) => void): Subscription {
  // @ts-ignore: Event name strictness
  return emitter.addListener("llmEvent", cb);
}

export async function loadModel(params: LoadModelParams): Promise<{ ok: true; engine: string }> {
  return await NativeModuleInstance.loadModel(params);
}

export async function unloadModel(): Promise<{ ok: true }> {
  return await NativeModuleInstance.unloadModel();
}

export async function status(): Promise<{ loaded: boolean; engine: string; version: string }> {
  return await NativeModuleInstance.status();
}

export async function health(): Promise<{ ok: boolean; details: string }> {
  return await NativeModuleInstance.health();
}

export async function stop(requestId: string): Promise<{ ok: true }> {
  return await NativeModuleInstance.stop(requestId);
}

export async function embed(text: string): Promise<{ vector: number[]; dim: number }> {
  return await NativeModuleInstance.embed(text);
}

export async function generate(params: GenerateParams): Promise<{ requestId: string }> {
  return await NativeModuleInstance.generate(params);
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
