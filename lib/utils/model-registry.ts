import type { ModelConfig, UnifiedLLMConfig } from '@/types';

export const MODEL_REGISTRY: ModelConfig[] = [
  {
    id: 'dolphin-llama-3.2-3b-4bit',
    name: 'Dolphin 3.0 Llama 3.2 3B (4-bit)',
    provider: 'huggingface',
    modelId: 'mlx-community/dolphin3.0-llama3.2-3B-4Bit',
    quantization: '4bit',
    contextWindow: 131072,
    parameters: 3_000_000_000,
    capabilities: {
      chat: true,
      embedding: true,
      reasoning: true,
      multimodal: false,
    },
    vramRequirement: 2.5,
    description: 'Dolphin 3.0 fine-tuned on Llama 3.2 3B with 4-bit quantization. Uncensored, highly capable reasoning model optimized for resource-constrained environments.',
  },
  {
    id: 'dolphin-llama-3.2-3b-fp16',
    name: 'Dolphin 3.0 Llama 3.2 3B (FP16)',
    provider: 'huggingface',
    modelId: 'cognitivecomputations/dolphin-3.0-llama-3.2-3b',
    quantization: 'fp16',
    contextWindow: 131072,
    parameters: 3_000_000_000,
    capabilities: {
      chat: true,
      embedding: true,
      reasoning: true,
      multimodal: false,
    },
    vramRequirement: 6.0,
    description: 'Full precision Dolphin 3.0 model with enhanced reasoning capabilities. Requires more VRAM but provides better quality.',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    contextWindow: 128000,
    parameters: 0,
    capabilities: {
      chat: true,
      embedding: false,
      reasoning: true,
      multimodal: true,
    },
    vramRequirement: 0,
    description: 'OpenAI GPT-4o Mini - cloud-based model with multimodal capabilities.',
  },
  {
    id: 'claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    modelId: 'claude-3-5-haiku-20241022',
    contextWindow: 200000,
    parameters: 0,
    capabilities: {
      chat: true,
      embedding: false,
      reasoning: true,
      multimodal: true,
    },
    vramRequirement: 0,
    description: 'Anthropic Claude 3.5 Haiku - fast, affordable, and highly intelligent.',
  },
];

export const DEFAULT_LLM_CONFIG: UnifiedLLMConfig = {
  activeModelId: 'dolphin-llama-3.2-3b-4bit',
  models: MODEL_REGISTRY,
  embeddingModelId: 'dolphin-llama-3.2-3b-4bit',
  fallbackModelId: 'gpt-4o-mini',
};

export class ModelRegistry {
  private config: UnifiedLLMConfig = DEFAULT_LLM_CONFIG;

  getActiveModel(): ModelConfig | null {
    return this.config.models.find(m => m.id === this.config.activeModelId) || null;
  }

  getEmbeddingModel(): ModelConfig | null {
    const embeddingId = this.config.embeddingModelId || this.config.activeModelId;
    return this.config.models.find(m => m.id === embeddingId) || null;
  }

  getFallbackModel(): ModelConfig | null {
    if (!this.config.fallbackModelId) return null;
    return this.config.models.find(m => m.id === this.config.fallbackModelId) || null;
  }

  setActiveModel(modelId: string): boolean {
    const model = this.config.models.find(m => m.id === modelId);
    
    if (!model) {
      console.error(`[ModelRegistry] Model ${modelId} not found`);
      return false;
    }

    this.config.activeModelId = modelId;
    console.log(`[ModelRegistry] Switched to ${model.name} (${model.vramRequirement}GB VRAM)`);
    return true;
  }

  setEmbeddingModel(modelId: string): boolean {
    const model = this.config.models.find(m => m.id === modelId);
    
    if (!model) {
      console.error(`[ModelRegistry] Model ${modelId} not found`);
      return false;
    }

    if (!model.capabilities.embedding) {
      console.error(`[ModelRegistry] Model ${modelId} does not support embeddings`);
      return false;
    }

    this.config.embeddingModelId = modelId;
    console.log(`[ModelRegistry] Set embedding model to ${model.name}`);
    return true;
  }

  setFallbackModel(modelId: string): boolean {
    const model = this.config.models.find(m => m.id === modelId);
    
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

  getModelsByCapability(capability: keyof ModelConfig['capabilities']): ModelConfig[] {
    return this.config.models.filter(m => m.capabilities[capability]);
  }

  getLocalModels(): ModelConfig[] {
    return this.config.models.filter(m => m.provider === 'local' || m.provider === 'huggingface');
  }

  getCloudModels(): ModelConfig[] {
    return this.config.models.filter(m => m.provider === 'openai' || m.provider === 'anthropic');
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
    this.config = config;
    console.log(`[ModelRegistry] Imported config with ${config.models.length} models`);
  }

  getStats() {
    const activeModel = this.getActiveModel();
    const embeddingModel = this.getEmbeddingModel();
    const fallbackModel = this.getFallbackModel();

    return {
      activeModel: activeModel?.name || 'None',
      activeModelVRAM: activeModel?.vramRequirement || 0,
      embeddingModel: embeddingModel?.name || 'None',
      fallbackModel: fallbackModel?.name || 'None',
      totalModels: this.config.models.length,
      localModels: this.getLocalModels().length,
      cloudModels: this.getCloudModels().length,
      totalVRAMRequired: this.getTotalVRAMRequired(),
    };
  }
}
