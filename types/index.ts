export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  confidence?: number;
  source?: 'local' | 'cached';
  embedding?: number[];
  metadata?: {
    reasoning?: string;
    curiosityGap?: boolean;
    contextUsed?: string[];
    introspection?: boolean;
    affectiveState?: any;
    curiosityMetrics?: any;
    mimicryMetrics?: any;
    reflectiveMetrics?: any;
    protoMetrics?: any;
    emergence?: any;
  };
}

export interface MemoryEntry {
  id: string;
  userId: string;
  content: string;
  embedding: number[];
  timestamp: number;
  expiresAt: number;
  importance: number;
  accessCount: number;
}

export interface PersonalityProfile {
  userId: string;
  style: 'technical' | 'casual' | 'formal' | 'creative';
  verbosity: 'concise' | 'normal' | 'detailed';
  learningRate: number;
  adaptationHistory: {
    timestamp: number;
    adjustment: string;
  }[];
}

export interface EvolutionCycle {
  id: string;
  timestamp: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'deferred';
  reason?: string;
  metrics?: {
    samplesCollected: number;
    confidenceAvg: number;
    carbonIntensity?: number;
    energyBudget?: number;
  };
  duration?: number;
}

export interface SystemMetrics {
  memoryUsage: {
    shortTerm: number;
    longTerm: number;
    maxCapacity: number;
  };
  inferenceStats: {
    totalRequests: number;
    avgLatency: number;
    cacheHitRate: number;
    fallbackCount: number;
  };
  evolutionStats: {
    cyclesCompleted: number;
    lastCycleTimestamp?: number;
    nextScheduled?: number;
  };
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'huggingface' | 'openai' | 'anthropic' | 'local';
  modelId: string;
  quantization?: '4bit' | '8bit' | 'fp16' | 'fp32';
  contextWindow: number;
  parameters: number;
  capabilities: {
    chat: boolean;
    embedding: boolean;
    reasoning: boolean;
    multimodal: boolean;
  };
  vramRequirement: number;
  description: string;
  tokenizer?: ModelTokenizer;
}

export interface UnifiedLLMConfig {
  activeModelId: string;
  models: ModelConfig[];
  embeddingModelId?: string;
  fallbackModelId?: string;
}

export interface ModelTokenizer {
  countTokens: (text: string) => number;
  encodeText?: (text: string) => { inputIds: number[]; attentionMask: number[] };
  decodeTokens?: (ids: number[]) => string;
}
