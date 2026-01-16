import type { ModelConfig, ModelTokenizer, UnifiedLLMConfig } from "@/types";
import {
  WEB_LLM_MODEL_CONFIG_ID,
  WEB_LLM_MODEL_ID,
} from "@/lib/constants/web-llm";

import { countTokens, decodeTokens, encodeText } from "@/lib/utils/tokenizer";

const buildLlamaTokenizer = (): ModelTokenizer => ({
  countTokens,
  encodeText,
  decodeTokens,
});

const buildHeuristicTokenizer = (charsPerToken = 4): ModelTokenizer => ({
  countTokens: (text: string) =>
    Math.max(Math.ceil(text.length / charsPerToken), 1),
});

export const MODEL_REGISTRY: ModelConfig[] = [
  {
    id: WEB_LLM_MODEL_CONFIG_ID,
    name: "WebLLM Llama 3.2 1B (WebGPU)",
    provider: "webllm",
    modelId: WEB_LLM_MODEL_ID,
    quantization: "4bit",
    contextWindow: 8192,
    parameters: 1_000_000_000,
    capabilities: {
      chat: true,
      embedding: true,
      reasoning: true,
      multimodal: false,
    },
    vramRequirement: 1.2,
    description:
      "WebLLM Llama 3.2 1B optimized for WebGPU inference in modern browsers.",
    tokenizer: buildHeuristicTokenizer(4),
  },
  {
    id: "dolphin-llama-3.2-3b-4bit",
    name: "Dolphin 3.0 Llama 3.2 3B (4-bit)",
    provider: "huggingface",
    modelId: "mlx-community/dolphin3.0-llama3.2-3B-4Bit",
    quantization: "4bit",
    contextWindow: 131072,
    parameters: 3_000_000_000,
    capabilities: {
      chat: true,
      embedding: true,
      reasoning: true,
      multimodal: false,
    },
    vramRequirement: 2.5,
    description:
      "Dolphin 3.0 fine-tuned on Llama 3.2 3B with 4-bit quantization. Uncensored, highly capable reasoning model optimized for resource-constrained environments.",
    tokenizer: buildLlamaTokenizer(),
  },
  {
    id: "dolphin-llama-3.2-3b-fp16",
    name: "Dolphin 3.0 Llama 3.2 3B (FP16)",
    provider: "huggingface",
    modelId: "cognitivecomputations/dolphin-3.0-llama-3.2-3b",
    quantization: "fp16",
    contextWindow: 131072,
    parameters: 3_000_000_000,
    capabilities: {
      chat: true,
      embedding: true,
      reasoning: true,
      multimodal: false,
    },
    vramRequirement: 6.0,
    description:
      "Full precision Dolphin 3.0 model with enhanced reasoning capabilities. Requires more VRAM but provides better quality.",
    tokenizer: buildLlamaTokenizer(),
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    modelId: "gpt-4o-mini",
    contextWindow: 128000,
    parameters: 0,
    capabilities: {
      chat: true,
      embedding: false,
      reasoning: true,
      multimodal: true,
    },
    vramRequirement: 0,
    description:
      "OpenAI GPT-4o Mini - cloud-based model with multimodal capabilities.",
    tokenizer: buildHeuristicTokenizer(3),
  },
  {
    id: "claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    modelId: "claude-3-5-haiku-20241022",
    contextWindow: 200000,
    parameters: 0,
    capabilities: {
      chat: true,
      embedding: false,
      reasoning: true,
      multimodal: true,
    },
    vramRequirement: 0,
    description:
      "Anthropic Claude 3.5 Haiku - fast, affordable, and highly intelligent.",
    tokenizer: buildHeuristicTokenizer(3),
  },
];

const isWebRuntime =
  typeof window !== "undefined" && typeof document !== "undefined";

export const DEFAULT_LLM_CONFIG: UnifiedLLMConfig = {
  activeModelId: isWebRuntime
    ? WEB_LLM_MODEL_CONFIG_ID
    : "dolphin-llama-3.2-3b-4bit",
  models: MODEL_REGISTRY,
  embeddingModelId: isWebRuntime
    ? WEB_LLM_MODEL_CONFIG_ID
    : "dolphin-llama-3.2-3b-4bit",
  fallbackModelId: "gpt-4o-mini",
};

export class ModelRegistry {
  private config: UnifiedLLMConfig;

  constructor() {
    this.config = this.hydrateConfig(DEFAULT_LLM_CONFIG);
  }

  getActiveModel(): ModelConfig | null {
    return (
      this.config.models.find((m) => m.id === this.config.activeModelId) || null
    );
  }

  getEmbeddingModel(): ModelConfig | null {
    const embeddingId =
      this.config.embeddingModelId || this.config.activeModelId;
    return this.config.models.find((m) => m.id === embeddingId) || null;
  }

  getFallbackModel(): ModelConfig | null {
    if (!this.config.fallbackModelId) return null;
    return (
      this.config.models.find((m) => m.id === this.config.fallbackModelId) ||
      null
    );
  }

  setActiveModel(modelId: string): boolean {
    const model = this.config.models.find((m) => m.id === modelId);

    if (!model) {
      console.error(`[ModelRegistry] Model ${modelId} not found`);
      return false;
    }

    this.config.activeModelId = modelId;
    console.log(
      `[ModelRegistry] Switched to ${model.name} (${model.vramRequirement}GB VRAM)`,
    );
    return true;
  }

  setEmbeddingModel(modelId: string): boolean {
    const model = this.config.models.find((m) => m.id === modelId);

    if (!model) {
      console.error(`[ModelRegistry] Model ${modelId} not found`);
      return false;
    }

    if (!model.capabilities.embedding) {
      console.error(
        `[ModelRegistry] Model ${modelId} does not support embeddings`,
      );
      return false;
    }

    this.config.embeddingModelId = modelId;
    console.log(`[ModelRegistry] Set embedding model to ${model.name}`);
    return true;
  }

  setFallbackModel(modelId: string): boolean {
    const model = this.config.models.find((m) => m.id === modelId);

    if (!model) {
      console.error(`[ModelRegistry] Model ${modelId} not found`);
      return false;
    }

    this.config.fallbackModelId = modelId;
    console.log(`[ModelRegistry] Set fallback model to ${model.name}`);
    return true;
  }

  listAvailableModels(): ModelConfig[] {
    return [...this.config.models];
  }

  getModelsByCapability(
    capability: keyof ModelConfig["capabilities"],
  ): ModelConfig[] {
    return this.config.models.filter((m) => m.capabilities[capability]);
  }

  getLocalModels(): ModelConfig[] {
    return this.config.models.filter(
      (m) => m.provider === "local" || m.provider === "huggingface",
    );
  }

  getCloudModels(): ModelConfig[] {
    return this.config.models.filter(
      (m) => m.provider === "openai" || m.provider === "anthropic",
    );
  }

  getTotalVRAMRequired(): number {
    const activeModel = this.getActiveModel();
    const embeddingModel = this.getEmbeddingModel();

    if (!activeModel) return 0;

    if (embeddingModel && embeddingModel.id === activeModel.id) {
      return activeModel.vramRequirement;
    }

    return activeModel.vramRequirement + (embeddingModel?.vramRequirement || 0);
  }

  exportConfig(): UnifiedLLMConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  importConfig(config: UnifiedLLMConfig): void {
    this.config = this.hydrateConfig(config);
    console.log(
      `[ModelRegistry] Imported config with ${config.models.length} models`,
    );
  }

  getStats() {
    const activeModel = this.getActiveModel();
    const embeddingModel = this.getEmbeddingModel();
    const fallbackModel = this.getFallbackModel();

    return {
      activeModel: activeModel?.name || "None",
      activeModelVRAM: activeModel?.vramRequirement || 0,
      embeddingModel: embeddingModel?.name || "None",
      fallbackModel: fallbackModel?.name || "None",
      totalModels: this.config.models.length,
      localModels: this.getLocalModels().length,
      cloudModels: this.getCloudModels().length,
      totalVRAMRequired: this.getTotalVRAMRequired(),
    };
  }

  private hydrateConfig(config: UnifiedLLMConfig): UnifiedLLMConfig {
    const hydratedModels = config.models.map((model) => {
      const registryModel = MODEL_REGISTRY.find((m) => m.id === model.id);

      if (registryModel?.tokenizer) {
        return { ...model, tokenizer: registryModel.tokenizer };
      }

      return model;
    });

    return { ...config, models: hydratedModels };
  }
}
