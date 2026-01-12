export interface LLMModel {
  id: string;
  name: string;
  displayName: string;
  description: string;
  size: number;
  sizeFormatted: string;
  format?: "coreml" | "mlx";
  quantization: "int4" | "int8" | "float16" | "float32";
  parameters: string;
  contextLength: number;
  downloadUrl?: string;
  huggingFaceRepo?: string;
  localPath?: string;
  isDownloaded: boolean;
  isLoaded: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  capabilities: ModelCapability[];
  metadata?: ModelMetadata;
}

export interface ModelCapability {
  type: "embedding" | "generation" | "chat" | "completion";
  enabled: boolean;
}

export interface ModelMetadata {
  version: string;
  author: string;
  license: string;
  baseModel: string;
  lastUpdated: string;
  checksumSHA256?: string;
}

export interface DownloadProgress {
  modelId: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speed: number;
  estimatedTimeRemaining: number;
  status: "idle" | "downloading" | "paused" | "completed" | "error";
  error?: string;
}

export interface ModelSettings {
  maxBatchSize: number;
  computeUnits: "all" | "cpuAndGPU" | "cpuOnly";
  enableEncryption: boolean;
  maxCacheSize: number;
  defaultTemperature: number;
  defaultMaxTokens: number;
  enableLogging: boolean;
  autoLoadOnStartup: boolean;
  selectedModelId: string | null;
}

export interface ModelPerformanceStats {
  modelId: string;
  totalInferences: number;
  averageLatency: number;
  medianLatency: number;
  p95Latency: number;
  successRate: number;
  lastUsed: string;
  memoryUsage: number;
}

export interface ModelValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checksumValid?: boolean;
  compatibleWithDevice: boolean;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  maxBatchSize: 8,
  computeUnits: "all",
  enableEncryption: true,
  maxCacheSize: 500,
  defaultTemperature: 0.7,
  defaultMaxTokens: 512,
  enableLogging: true,
  autoLoadOnStartup: false,
  selectedModelId: null,
};

export interface HuggingFaceRepo {
  repo: string;
  files: string[];
}

export const AVAILABLE_MODELS: LLMModel[] = [
  {
    id: "dolphin-3.0-llama-3b-4bit",
    name: "dolphin-3.0-llama-3b-4bit",
    displayName: "Dolphin 3.0 Llama 3B (4-bit)",
    description:
      "Dolphin 3.0 fine-tuned on Llama 3.2 3B with 4-bit quantization - uncensored conversational AI optimized for mobile",
    size: 2.0 * 1024 * 1024 * 1024,
    sizeFormatted: "2.0 GB",
    format: "mlx",
    quantization: "int4",
    parameters: "3B",
    contextLength: 131072,
    huggingFaceRepo: "mlx-community/dolphin3.0-llama3.2-3B-4bit",
    isDownloaded: false,
    isLoaded: false,
    isDownloading: false,
    downloadProgress: 0,
    capabilities: [
      { type: "chat", enabled: true },
      { type: "completion", enabled: true },
      { type: "generation", enabled: true },
      { type: "embedding", enabled: true },
    ],
    metadata: {
      version: "3.0",
      author: "Cognitive Computations / mlx-community",
      license: "Apache 2.0",
      baseModel: "Llama 3.2 3B",
      lastUpdated: "2024-12-15",
    },
  },
  {
    id: "llama-3.2-1b-instruct-4bit",
    name: "llama-3.2-1b-instruct-4bit",
    displayName: "Llama 3.2 1B Instruct (4-bit)",
    description: "Compact Llama 3.2 1B instruction-tuned model with 4-bit quantization for efficient mobile inference",
    size: 0.8 * 1024 * 1024 * 1024,
    sizeFormatted: "800 MB",
    format: "mlx",
    quantization: "int4",
    parameters: "1B",
    contextLength: 131072,
    huggingFaceRepo: "mlx-community/Llama-3.2-1B-Instruct-4bit",
    isDownloaded: false,
    isLoaded: false,
    isDownloading: false,
    downloadProgress: 0,
    capabilities: [
      { type: "chat", enabled: true },
      { type: "completion", enabled: true },
      { type: "generation", enabled: true },
      { type: "embedding", enabled: true },
    ],
    metadata: {
      version: "3.2",
      author: "Meta / mlx-community",
      license: "Llama 3.2 License",
      baseModel: "Llama 3.2 1B",
      lastUpdated: "2024-09-25",
    },
  },
  {
    id: "llama-3.2-3b-instruct-4bit",
    name: "llama-3.2-3b-instruct-4bit",
    displayName: "Llama 3.2 3B Instruct (4-bit)",
    description: "Llama 3.2 3B instruction-tuned model with 4-bit quantization for mobile inference",
    size: 2.0 * 1024 * 1024 * 1024,
    sizeFormatted: "2.0 GB",
    format: "mlx",
    quantization: "int4",
    parameters: "3B",
    contextLength: 131072,
    huggingFaceRepo: "mlx-community/Llama-3.2-3B-Instruct-4bit",
    isDownloaded: false,
    isLoaded: false,
    isDownloading: false,
    downloadProgress: 0,
    capabilities: [
      { type: "chat", enabled: true },
      { type: "completion", enabled: true },
      { type: "generation", enabled: true },
      { type: "embedding", enabled: true },
    ],
    metadata: {
      version: "3.2",
      author: "Meta / mlx-community",
      license: "Llama 3.2 License",
      baseModel: "Llama 3.2 3B",
      lastUpdated: "2024-09-25",
    },
  },
  {
    id: "qwen2.5-1.5b-instruct-4bit",
    name: "qwen2.5-1.5b-instruct-4bit",
    displayName: "Qwen 2.5 1.5B Instruct (4-bit)",
    description: "Qwen 2.5 1.5B instruction-tuned model - excellent multilingual support with efficient 4-bit quantization",
    size: 1.0 * 1024 * 1024 * 1024,
    sizeFormatted: "1.0 GB",
    format: "mlx",
    quantization: "int4",
    parameters: "1.5B",
    contextLength: 32768,
    huggingFaceRepo: "mlx-community/Qwen2.5-1.5B-Instruct-4bit",
    isDownloaded: false,
    isLoaded: false,
    isDownloading: false,
    downloadProgress: 0,
    capabilities: [
      { type: "chat", enabled: true },
      { type: "completion", enabled: true },
      { type: "generation", enabled: true },
      { type: "embedding", enabled: true },
    ],
    metadata: {
      version: "2.5",
      author: "Alibaba / mlx-community",
      license: "Apache 2.0",
      baseModel: "Qwen 2.5 1.5B",
      lastUpdated: "2024-10-01",
    },
  },
];
