import { WEB_LLM_MODEL_ID } from "@/lib/constants/web-llm";

export interface WebLLMProgress {
  progress: number;
  text: string;
}

export interface WebLLMStatus {
  initialized: boolean;
  modelId: string | null;
  webgpuSupported: boolean;
  lastError?: string;
}

interface WebLLMChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface WebLLMChatRequest {
  messages: WebLLMChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}

interface WebLLMChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface WebLLMEmbeddingResponse {
  data?: Array<{
    embedding?: number[];
  }>;
}

interface WebLLMEngine {
  chat: {
    completions: {
      create: (request: WebLLMChatRequest) => Promise<WebLLMChatResponse>;
    };
  };
  embeddings?: {
    create: (request: { input: string }) => Promise<WebLLMEmbeddingResponse>;
  };
}

class WebLLMService {
  private engine: WebLLMEngine | null = null;
  private initPromise: Promise<WebLLMEngine> | null = null;
  private activeModelId: string | null = null;
  private lastError?: string;

  isWebGPUSupported(): boolean {
    const isWebRuntime =
      typeof window !== "undefined" && typeof document !== "undefined";

    if (!isWebRuntime || typeof navigator === "undefined") {
      return false;
    }

    const navigatorWithGPU = navigator as Navigator & {
      gpu?: { requestAdapter?: () => Promise<unknown> };
    };

    return typeof navigatorWithGPU.gpu?.requestAdapter === "function";
  }

  getStatus(): WebLLMStatus {
    return {
      initialized: Boolean(this.engine),
      modelId: this.activeModelId,
      webgpuSupported: this.isWebGPUSupported(),
      lastError: this.lastError,
    };
  }

  async initialize(
    modelId: string = WEB_LLM_MODEL_ID,
    onProgress?: (progress: WebLLMProgress) => void,
  ): Promise<WebLLMEngine> {
    const isWebRuntime =
      typeof window !== "undefined" && typeof document !== "undefined";

    if (!isWebRuntime) {
      const message = "[WebLLM] WebLLM can only initialize on web platforms";
      this.lastError = message;
      throw new Error(message);
    }

    if (!this.isWebGPUSupported()) {
      const message = "[WebLLM] WebGPU is not available in this browser";
      this.lastError = message;
      throw new Error(message);
    }

    if (this.engine && this.activeModelId === modelId) {
      return this.engine;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

    this.initPromise = (async () => {
      try {
        const engine = (await CreateMLCEngine(modelId, {
          initProgressCallback: (report: {
            progress: number;
            text: string;
          }) => {
            onProgress?.({ progress: report.progress, text: report.text });
          },
        })) as WebLLMEngine;

        this.engine = engine;
        this.activeModelId = modelId;
        this.lastError = undefined;
        return engine;
      } catch (error) {
        this.engine = null;
        this.activeModelId = null;
        this.lastError = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  async generateText(
    prompt: string,
    options: {
      modelId?: string;
      maxTokens?: number;
      temperature?: number;
      topP?: number;
    } = {},
  ): Promise<string> {
    const modelId = options.modelId ?? WEB_LLM_MODEL_ID;
    const engine = await this.initialize(modelId, (progress) => {
      console.log(
        `[WebLLM] Loading ${modelId}: ${Math.round(progress.progress * 100)}%`,
      );
    });

    const response = await engine.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      max_tokens: options.maxTokens ?? 128,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.9,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      const message = "[WebLLM] Empty response from WebLLM engine";
      this.lastError = message;
      throw new Error(message);
    }

    return content;
  }

  async generateEmbedding(
    text: string,
    options: { modelId?: string; normalize?: boolean } = {},
  ): Promise<number[]> {
    const modelId = options.modelId ?? WEB_LLM_MODEL_ID;
    const engine = await this.initialize(modelId);

    if (!engine.embeddings) {
      const message = "[WebLLM] Embeddings are not available on this model";
      this.lastError = message;
      throw new Error(message);
    }

    const response = await engine.embeddings.create({ input: text });
    const embedding = response.data?.[0]?.embedding;

    if (!embedding) {
      const message = "[WebLLM] No embedding returned from WebLLM engine";
      this.lastError = message;
      throw new Error(message);
    }

    if (options.normalize === false) {
      return embedding;
    }

    const magnitude = Math.sqrt(
      embedding.reduce((sum, value) => sum + value * value, 0),
    );
    if (magnitude === 0) {
      return embedding;
    }

    return embedding.map((value) => value / magnitude);
  }
}

export const webLLMService = new WebLLMService();
