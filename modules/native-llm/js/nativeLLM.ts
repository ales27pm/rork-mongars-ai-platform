import { NativeModules, NativeEventEmitter } from 'react-native';

const { 'native-llm': NativeLLM } = NativeModules;
const emitter = new NativeEventEmitter(NativeLLM);

export type LoadModelParams = { modelPath: string; profile?: string };
export type GenerateParams = {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topK?: number;
  seed?: number;
};

export type LLMEvent =
  | { type: 'token'; requestId: string; token: string }
  | { type: 'done'; requestId: string; output: string; tokens?: number; ms?: number }
  | { type: 'error'; requestId: string; message: string };

export const loadModel = (params: LoadModelParams) => NativeLLM.loadModel(params);
export const generate = (params: GenerateParams) => NativeLLM.generate(params);
export const stop = (requestId: string) => NativeLLM.stop(requestId);
export const embed = (text: string) => NativeLLM.embed(text);
export const status = () => NativeLLM.status();
export const health = () => NativeLLM.health();

export const addLLMListener = (listener: (event: LLMEvent) => void) => {
  return emitter.addListener('llmEvent', listener);
};
