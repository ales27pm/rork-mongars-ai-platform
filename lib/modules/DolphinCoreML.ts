import { Platform, NativeModules } from 'react-native';

export interface ModelConfig {
  modelName?: string;
  enableEncryption?: boolean;
  maxBatchSize?: number;
  computeUnits?: 'all' | 'cpuAndGPU' | 'cpuOnly';
}

export interface EncodingOptions {
  normalize?: boolean;
  pooling?: 'mean' | 'max' | 'cls';
  maxLength?: number;
  truncation?: boolean;
}

export interface GenerationParameters {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  repetitionPenalty?: number;
  stopSequences?: string[];
}

export interface PerformanceMetrics {
  encoding?: {
    average: number;
    median: number;
    p95: number;
    count: number;
  };
  generation?: {
    average: number;
    median: number;
    p95: number;
    count: number;
  };
  totalInferences: number;
  lastOperationDuration?: number;
  lastOperationType?: string;
}

export interface DeviceInfo {
  deviceModel: string;
  systemVersion: string;
  processorCount: number;
  physicalMemory: number;
  thermalState: number;
  isLowPowerModeEnabled: boolean;
}

interface DolphinCoreMLNativeModule {
  initialize(config: ModelConfig): Promise<{
    success: boolean;
    metadata: any;
    deviceInfo: DeviceInfo;
    error?: { code: string; message: string };
  }>;
  
  encodeBatch(texts: string[], options?: EncodingOptions): Promise<number[][]>;
  
  generateStream(prompt: string, params?: GenerationParameters): Promise<string>;

  getMetrics(): Promise<PerformanceMetrics>;

  unloadModel(): Promise<boolean>;
}

class DolphinCoreMLFallback implements DolphinCoreMLNativeModule {
  private modelLoaded = false;
  private modelName: string | null = null;
  private hasLoggedFallback = false;

  async initialize(config: ModelConfig) {
    if (!this.hasLoggedFallback) {
      console.log('[DolphinCoreML] Running in fallback mode - native module requires iOS device with custom build');
      this.hasLoggedFallback = true;
    }
    
    if (Platform.OS === 'web') {
      return {
        success: false,
        error: {
          code: 'PLATFORM_NOT_SUPPORTED',
          message: 'Local model inference requires iOS device with custom build. Use "Build for iOS" to create native app.'
        },
        metadata: {
          modelName: config.modelName || 'Dolphin',
          version: '1.0.0-fallback',
          loadTime: 0
        },
        deviceInfo: {
          deviceModel: 'Web Browser',
          systemVersion: Platform.Version.toString(),
          processorCount: 4,
          physicalMemory: 4294967296,
          thermalState: 0,
          isLowPowerModeEnabled: false
        }
      };
    }

    return {
      success: false,
      error: {
        code: 'NATIVE_MODULE_NOT_FOUND',
        message: 'Native module requires custom iOS build. Run "eas build" to create development build.'
      },
      metadata: {
        modelName: config.modelName || 'Dolphin',
        version: '1.0.0-fallback',
        loadTime: 0
      },
      deviceInfo: {
        deviceModel: 'Expo Go',
        systemVersion: Platform.Version.toString(),
        processorCount: 4,
        physicalMemory: 4294967296,
        thermalState: 0,
        isLowPowerModeEnabled: false
      }
    };
  }

  async encodeBatch(texts: string[], options?: EncodingOptions) {
    console.log('[DolphinCoreML Fallback] Encoding batch:', texts.length, 'texts');
    
    if (Platform.OS === 'web') {
      console.warn('[DolphinCoreML] Using deterministic embeddings on web (not real model)');
    }
    
    const dimension = 384;
    
    return texts.map(text => {
      const embedding: number[] = [];
      let hash = 0;
      
      for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash = hash & hash;
      }
      
      for (let i = 0; i < dimension; i++) {
        const seed = hash + i * 0.123456;
        const value = Math.sin(seed) * Math.cos(seed * 0.987654);
        embedding.push(value);
      }
      
      if (options?.normalize !== false) {
        const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
        return embedding.map(v => v / magnitude);
      }
      
      return embedding;
    });
  }

  async generateStream(prompt: string, params?: GenerationParameters): Promise<string> {
    console.log('[DolphinCoreML] Generation requested - native module required');
    
    const errorMessage = Platform.OS === 'web' 
      ? 'REQUIRES_NATIVE_BUILD: Local LLM inference requires iOS device with custom build. Build the app using "eas build" and install on device.'
      : 'REQUIRES_NATIVE_BUILD: Native module not available in Expo Go. Create a development build using "eas build --profile development".'
    
    throw new Error(errorMessage);
  }

  async getMetrics() {
    return {
      encoding: {
        average: 0,
        median: 0,
        p95: 0,
        count: 0
      },
      generation: {
        average: 0,
        median: 0,
        p95: 0,
        count: 0
      },
      totalInferences: 0,
      lastOperationDuration: 0,
      lastOperationType: 'fallback'
    };
  }

  async unloadModel() {
    this.modelLoaded = false;
    this.modelName = null;
    return true;
  }
}

export class DolphinCoreML {
  private module: DolphinCoreMLNativeModule;
  private initialized = false;
  
  constructor() {
    if (Platform.OS === 'ios') {
      try {
        const nativeModule = NativeModules.DolphinCoreML;
        if (nativeModule) {
          console.log('[DolphinCoreML] Using native iOS module');
          this.module = nativeModule as DolphinCoreMLNativeModule;
        } else {
          console.warn('[DolphinCoreML] Native module not found, using fallback');
          this.module = new DolphinCoreMLFallback();
        }
      } catch (error) {
        console.warn('[DolphinCoreML] Failed to load native module, using fallback:', error);
        this.module = new DolphinCoreMLFallback();
      }
    } else {
      console.log('[DolphinCoreML] Non-iOS platform, using fallback');
      this.module = new DolphinCoreMLFallback();
    }
  }
  
  async initialize(config: ModelConfig = {}) {
    const defaultConfig: ModelConfig = {
      modelName: 'Dolphin',
      enableEncryption: true,
      maxBatchSize: 8,
      computeUnits: 'all',
      ...config
    };
    
    try {
      const result = await this.module.initialize(defaultConfig);

      if (!result.success) {
        this.initialized = false;
        const errorMessage = result.error?.message || 'Failed to load DolphinCoreML model';
        throw new Error(result.error?.code ? `${result.error.code}: ${errorMessage}` : errorMessage);
      }

      this.initialized = result.success;
      return result;
    } catch (error) {
      console.error('[DolphinCoreML] Initialization failed:', error);
      throw error;
    }
  }
  
  async encode(text: string, options?: EncodingOptions): Promise<number[]> {
    if (!this.initialized) {
      throw new Error('Model not initialized. Call initialize() first.');
    }
    
    const results = await this.encodeBatch([text], options);
    return results[0] || [];
  }
  
  async encodeBatch(texts: string[], options?: EncodingOptions): Promise<number[][]> {
    if (!this.initialized) {
      throw new Error('Model not initialized. Call initialize() first.');
    }
    
    if (!texts.length) return [];
    
    const defaultOptions: EncodingOptions = {
      normalize: true,
      pooling: 'mean',
      maxLength: 512,
      truncation: true,
      ...options
    };
    
    try {
      return await this.module.encodeBatch(texts, defaultOptions);
    } catch (error) {
      console.error('[DolphinCoreML] Encoding failed:', error);
      throw error;
    }
  }
  
  async generate(prompt: string, params?: GenerationParameters, onToken?: (token: string) => void): Promise<string> {
    if (!this.initialized) {
      throw new Error('Model not initialized. Call initialize() first.');
    }
    
    const defaultParams: GenerationParameters = {
      maxTokens: 100,
      temperature: 0.7,
      topP: 0.9,
      repetitionPenalty: 1.1,
      stopSequences: [],
      ...params
    };
    
    try {
      return await this.module.generateStream(prompt, defaultParams);
    } catch (error) {
      console.error('[DolphinCoreML] Generation failed:', error);
      throw error;
    }
  }
  
  async generateWithTokens(tokenIds: number[], params?: GenerationParameters): Promise<string> {
    if (!this.initialized) {
      throw new Error('Model not initialized. Call initialize() first.');
    }
    
    const defaultParams: GenerationParameters = {
      maxTokens: 100,
      temperature: 0.7,
      topP: 0.9,
      repetitionPenalty: 1.1,
      stopSequences: [],
      ...params
    };
    
    try {
      return await this.module.generateStream(JSON.stringify(tokenIds), defaultParams);
    } catch (error) {
      console.error('[DolphinCoreML] Generation with tokens failed:', error);
      throw error;
    }
  }
  
  async getMetrics(): Promise<PerformanceMetrics> {
    try {
      return await this.module.getMetrics();
    } catch (error) {
      console.error('[DolphinCoreML] Failed to get metrics:', error);
      return {
        totalInferences: 0
      };
    }
  }

  async unloadModel() {
    try {
      const ok = await this.module.unloadModel();
      if (ok) {
        this.initialized = false;
      }
      return ok;
    } catch (error) {
      console.error('[DolphinCoreML] Failed to unload model:', error);
      return false;
    }
  }
}

export const dolphinCoreML = new DolphinCoreML();
export default dolphinCoreML;
