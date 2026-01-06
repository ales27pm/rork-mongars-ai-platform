export interface LLMModel {
  id: string;
  name: string;
  displayName: string;
  description: string;
  size: number;
  sizeFormatted: string;
  quantization: 'int4' | 'int8' | 'float16' | 'float32';
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
  type: 'embedding' | 'generation' | 'chat' | 'completion';
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
  status: 'idle' | 'downloading' | 'paused' | 'completed' | 'error';
  error?: string;
}

export interface ModelSettings {
  maxBatchSize: number;
  computeUnits: 'all' | 'cpuAndGPU' | 'cpuOnly';
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
  computeUnits: 'all',
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
    id: 'dolphin-3.0-coreml',
    name: 'dolphin-3.0-coreml',
    displayName: 'Dolphin 3.0 CoreML',
    description: 'Dolphin 3.0 optimized for iOS with CoreML - uncensored conversational AI',
    size: 2.8 * 1024 * 1024 * 1024,
    sizeFormatted: '2.8 GB',
    quantization: 'int8',
    parameters: '3B',
    contextLength: 8192,
    downloadUrl: 'hf://ales27pm/Dolphin3.0-CoreML',
    huggingFaceRepo: 'ales27pm/Dolphin3.0-CoreML',
    isDownloaded: false,
    isLoaded: false,
    isDownloading: false,
    downloadProgress: 0,
    capabilities: [
      { type: 'chat', enabled: true },
      { type: 'completion', enabled: true },
      { type: 'generation', enabled: true },
      { type: 'embedding', enabled: true },
    ],
    metadata: {
      version: '3.0',
      author: 'Cognitive Computations / ales27pm',
      license: 'Apache 2.0',
      baseModel: 'Llama 3.2 3B',
      lastUpdated: '2024-12-15',
    },
  },
  {
    id: 'llama-3.2-1b-coreml',
    name: 'llama-3.2-1b-coreml',
    displayName: 'Llama 3.2 1B CoreML',
    description: 'Compact Llama 3.2 1B model optimized for iOS with CoreML',
    size: 1.2 * 1024 * 1024 * 1024,
    sizeFormatted: '1.2 GB',
    quantization: 'int4',
    parameters: '1B',
    contextLength: 8192,
    downloadUrl: 'hf://apple/coreml-llama-3.2-1b-instruct-4bit',
    huggingFaceRepo: 'apple/coreml-llama-3.2-1b-instruct-4bit',
    isDownloaded: false,
    isLoaded: false,
    isDownloading: false,
    downloadProgress: 0,
    capabilities: [
      { type: 'chat', enabled: true },
      { type: 'completion', enabled: true },
      { type: 'generation', enabled: true },
      { type: 'embedding', enabled: true },
    ],
    metadata: {
      version: '3.2',
      author: 'Meta / Apple',
      license: 'Llama 3.2 License',
      baseModel: 'Llama 3.2 1B',
      lastUpdated: '2024-09-25',
    },
  },
  {
    id: 'llama-3.2-3b-coreml',
    name: 'llama-3.2-3b-coreml',
    displayName: 'Llama 3.2 3B CoreML',
    description: 'Llama 3.2 3B model optimized for iOS with CoreML',
    size: 2.1 * 1024 * 1024 * 1024,
    sizeFormatted: '2.1 GB',
    quantization: 'int4',
    parameters: '3B',
    contextLength: 8192,
    downloadUrl: 'hf://apple/coreml-llama-3.2-3b-instruct-4bit',
    huggingFaceRepo: 'apple/coreml-llama-3.2-3b-instruct-4bit',
    isDownloaded: false,
    isLoaded: false,
    isDownloading: false,
    downloadProgress: 0,
    capabilities: [
      { type: 'chat', enabled: true },
      { type: 'completion', enabled: true },
      { type: 'generation', enabled: true },
      { type: 'embedding', enabled: true },
    ],
    metadata: {
      version: '3.2',
      author: 'Meta / Apple',
      license: 'Llama 3.2 License',
      baseModel: 'Llama 3.2 3B',
      lastUpdated: '2024-09-25',
    },
  },
];
