export interface CoreMLModelConfig {
  modelName: string;
  modelPath?: string;
  enableEncryption: boolean;
  computeUnits: ComputeUnit;
  maxBatchSize: number;
  version?: string;
}

export enum ComputeUnit {
  All = "all",
  CPUAndGPU = "cpuAndGPU",
  CPUOnly = "cpuOnly",
}

export interface ModelMetadata {
  name: string;
  version: string;
  size: number;
  loadTime: number;
  inputShape: number[];
  outputShape: number[];
  parameters: number;
  quantization?: string;
}

export interface InferenceOptions {
  normalize: boolean;
  pooling: PoolingStrategy;
  maxLength: number;
  truncation: boolean;
  padToMaxLength?: boolean;
  returnAttentionMask?: boolean;
}

export enum PoolingStrategy {
  Mean = "mean",
  Max = "max",
  CLS = "cls",
  LastToken = "last_token",
}

export interface GenerationConfig {
  maxTokens: number;
  temperature: number;
  topP: number;
  topK?: number;
  repetitionPenalty: number;
  stopSequences: string[];
  streaming?: boolean;
}

export interface TokenizationResult {
  inputIds: number[];
  attentionMask?: number[];
  tokenTypeIds?: number[];
  specialTokensMask?: number[];
}

export interface EmbeddingResult {
  embedding: number[];
  pooledOutput?: number[];
  allHiddenStates?: number[][];
  dimensions: number;
  norm?: number;
}

export interface ModelPerformanceMetrics {
  averageInferenceTime: number;
  medianInferenceTime: number;
  p95InferenceTime: number;
  p99InferenceTime: number;
  totalInferences: number;
  failedInferences: number;
  successRate: number;
  memoryUsage: number;
  throughput: number;
}

export interface ModelCapabilities {
  textGeneration: boolean;
  textEmbedding: boolean;
  classification: boolean;
  sequenceToSequence: boolean;
  multiModal: boolean;
  streaming: boolean;
  batchProcessing: boolean;
}

export interface ModelLoadResult {
  success: boolean;
  metadata: ModelMetadata;
  capabilities: ModelCapabilities;
  deviceInfo: {
    platform: string;
    version: string;
    processorCount: number;
    memoryTotal: number;
    thermalState: number;
  };
  error?: string;
}

export interface BatchInferenceResult {
  embeddings: number[][];
  successfulCount: number;
  failedCount: number;
  duration: number;
  averageLatency: number;
}

export interface StreamingToken {
  token: string;
  tokenId: number;
  logprob?: number;
  isComplete: boolean;
  timestamp: number;
}

export interface ModelCacheEntry {
  key: string;
  result: number[] | string;
  timestamp: number;
  hits: number;
  size: number;
}

export interface CoreMLError {
  code: string;
  message: string;
  details?: Record<string, any>;
  recoverable: boolean;
  timestamp: number;
}

export enum CoreMLErrorCode {
  ModelNotFound = "MODEL_NOT_FOUND",
  ModelLoadFailed = "MODEL_LOAD_FAILED",
  InferenceFailed = "INFERENCE_FAILED",
  InvalidInput = "INVALID_INPUT",
  MemoryError = "MEMORY_ERROR",
  ThermalThrottling = "THERMAL_THROTTLING",
  Timeout = "TIMEOUT",
  NotInitialized = "NOT_INITIALIZED",
  UnsupportedOperation = "UNSUPPORTED_OPERATION",
}
