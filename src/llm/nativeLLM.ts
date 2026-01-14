import { requireNativeModule } from 'expo';

interface NativeLLMModule {
  loadModel(modelPath: string): Promise<string>;
  generate(prompt: string): AsyncIterable<string>;
  stop?(): void;
}

const nativeLLM: NativeLLMModule | null = (() => {
  try {
    return requireNativeModule('native-llm');
  } catch {
    console.warn('[NativeLLM] Native module not available, using mock');
    return null;
  }
})();

type LlmEventPayload = {
  type: 'token' | 'done' | 'error' | 'status';
  data: unknown;
};

export class NativeLLMClient {
  private listeners: { [key: string]: ((data: unknown) => void)[] } = {};

  constructor() {
    console.log('[NativeLLMClient] Initialized');
  }

  on(event: LlmEventPayload['type'], listener: (data: unknown) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: LlmEventPayload['type'], listener: (data: unknown) => void): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
  }

  emit(event: LlmEventPayload['type'], data: unknown): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach((listener) => listener(data));
    }
  }

  async loadModel(modelPath: string): Promise<void> {
    try {
      if (!nativeLLM) {
        this.emit('status', 'Mock: Model loaded (native module not available)');
        return;
      }
      const result = await nativeLLM.loadModel(modelPath);
      this.emit('status', 'Model Loaded: ' + result);
    } catch (error) {
      this.emit('error', error);
    }
  }

  async generate(prompt: string): Promise<void> {
    try {
      if (!nativeLLM) {
        const mockTokens = ['Hello', ' ', 'from', ' ', 'mock', ' ', 'LLM', '!'];
        for (const token of mockTokens) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.emit('token', token);
        }
        this.emit('done', null);
        return;
      }
      const tokenStream = nativeLLM.generate(prompt);
      for await (const token of tokenStream) {
        this.emit('token', token);
      }
      this.emit('done', null);
    } catch (error) {
      this.emit('error', error);
    }
  }

  stop(): void {
    try {
      if (nativeLLM?.stop) {
        nativeLLM.stop();
      }
      this.emit('status', 'Generation stopped');
    } catch (error) {
      this.emit('error', error);
    }
  }
}

export const createNativeLLMClient = (): NativeLLMClient => new NativeLLMClient();
