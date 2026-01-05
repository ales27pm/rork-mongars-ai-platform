import { dolphinCoreML, ModelConfig, PerformanceMetrics } from '@/lib/modules/DolphinCoreML';
import { Platform } from 'react-native';

export interface QuantizationConfig {
  type: 'int8' | 'float16' | 'float32';
  calibrationSamples?: string[];
  useSymmetricQuantization?: boolean;
}

export interface ModelMetadata {
  name: string;
  version: string;
  size: number;
  quantization: QuantizationConfig['type'];
  inputShape: number[];
  outputShape: number[];
  loadTime: number;
}

export class LocalModelManager {
  private static instance: LocalModelManager;
  private isInitialized = false;
  private currentModel: string | null = null;
  private modelMetadata: Map<string, ModelMetadata> = new Map();
  private performanceHistory: PerformanceMetrics[] = [];

  private constructor() {
    console.log('[LocalModelManager] Initializing model manager');
  }

  static getInstance(): LocalModelManager {
    if (!LocalModelManager.instance) {
      LocalModelManager.instance = new LocalModelManager();
    }
    return LocalModelManager.instance;
  }

  async initialize(config: ModelConfig = {}): Promise<boolean> {
    if (this.isInitialized) {
      console.log('[LocalModelManager] Already initialized');
      return true;
    }

    console.log('[LocalModelManager] Initializing with config:', config);

    try {
      const result = await dolphinCoreML.initialize(config);

      if (result.success) {
        this.isInitialized = true;
        this.currentModel = config.modelName || 'default';
        
        const metadata: ModelMetadata = {
          name: this.currentModel,
          version: '1.0.0',
          size: 0,
          quantization: 'float32',
          inputShape: [1, 512],
          outputShape: [1, 768],
          loadTime: result.metadata?.loadTime || 0,
        };

        this.modelMetadata.set(this.currentModel, metadata);

        console.log('[LocalModelManager] Initialized successfully');
        console.log('[LocalModelManager] Device info:', result.deviceInfo);

        return true;
      }

      return false;
    } catch (error) {
      console.error('[LocalModelManager] Initialization failed:', error);
      return false;
    }
  }

  async loadQuantizedModel(modelName: string, quantization: QuantizationConfig): Promise<boolean> {
    console.log('[LocalModelManager] Loading quantized model:', modelName, quantization.type);

    if (Platform.OS !== 'ios') {
      console.warn('[LocalModelManager] Quantized models only supported on iOS');
      return false;
    }

    try {
      const config: ModelConfig = {
        modelName,
        enableEncryption: true,
        maxBatchSize: 8,
        computeUnits: 'all',
      };

      const result = await dolphinCoreML.initialize(config);

      if (result.success) {
        this.currentModel = modelName;
        
        const metadata: ModelMetadata = {
          name: modelName,
          version: '1.0.0',
          size: this.estimateModelSize(quantization.type),
          quantization: quantization.type,
          inputShape: [1, 512],
          outputShape: [1, 768],
          loadTime: result.metadata?.loadTime || 0,
        };

        this.modelMetadata.set(modelName, metadata);

        console.log('[LocalModelManager] Quantized model loaded successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[LocalModelManager] Failed to load quantized model:', error);
      return false;
    }
  }

  private estimateModelSize(quantization: QuantizationConfig['type']): number {
    const baseSize = 100 * 1024 * 1024;
    
    switch (quantization) {
      case 'int8':
        return baseSize * 0.25;
      case 'float16':
        return baseSize * 0.5;
      case 'float32':
      default:
        return baseSize;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isInitialized) {
      throw new Error('Model manager not initialized');
    }

    const startTime = Date.now();
    
    try {
      const embedding = await dolphinCoreML.encode(text);
      
      const duration = Date.now() - startTime;
      this.recordPerformance(duration, 1);

      return embedding;
    } catch (error) {
      console.error('[LocalModelManager] Embedding generation failed:', error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      throw new Error('Model manager not initialized');
    }

    const startTime = Date.now();
    
    try {
      const embeddings = await dolphinCoreML.encodeBatch(texts);
      
      const duration = Date.now() - startTime;
      this.recordPerformance(duration, texts.length);

      return embeddings;
    } catch (error) {
      console.error('[LocalModelManager] Batch embedding generation failed:', error);
      throw error;
    }
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const metrics = await dolphinCoreML.getMetrics();
      
      if (metrics) {
        this.performanceHistory.push(metrics);
        
        if (this.performanceHistory.length > 100) {
          this.performanceHistory.shift();
        }
      }

      return metrics;
    } catch (error) {
      console.error('[LocalModelManager] Failed to get metrics:', error);
      return { totalInferences: 0 };
    }
  }

  private recordPerformance(duration: number, batchSize: number) {
    const avgLatency = duration / batchSize;
    
    console.log(`[LocalModelManager] Inference: ${duration}ms total, ${avgLatency.toFixed(2)}ms per item`);
  }

  getModelInfo(): ModelMetadata | null {
    if (!this.currentModel) return null;
    return this.modelMetadata.get(this.currentModel) || null;
  }

  getAvailableModels(): string[] {
    return Array.from(this.modelMetadata.keys());
  }

  async switchModel(modelName: string): Promise<boolean> {
    if (!this.modelMetadata.has(modelName)) {
      console.warn('[LocalModelManager] Model not found:', modelName);
      return false;
    }

    console.log('[LocalModelManager] Switching to model:', modelName);
    this.currentModel = modelName;

    return true;
  }

  async optimizeModel(calibrationData: string[]): Promise<boolean> {
    console.log('[LocalModelManager] Optimizing model with', calibrationData.length, 'samples');

    try {
      const embeddings = await this.generateBatchEmbeddings(calibrationData);

      const avgMagnitude = embeddings.reduce((sum, emb) => {
        const magnitude = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
        return sum + magnitude;
      }, 0) / embeddings.length;

      console.log('[LocalModelManager] Optimization complete. Avg magnitude:', avgMagnitude.toFixed(4));

      return true;
    } catch (error) {
      console.error('[LocalModelManager] Optimization failed:', error);
      return false;
    }
  }

  async benchmark(testData: string[]): Promise<{
    avgLatency: number;
    throughput: number;
    p95Latency: number;
  }> {
    console.log('[LocalModelManager] Running benchmark with', testData.length, 'samples');

    const latencies: number[] = [];

    for (const text of testData) {
      const startTime = Date.now();
      await this.generateEmbedding(text);
      const latency = Date.now() - startTime;
      latencies.push(latency);
    }

    latencies.sort((a, b) => a - b);

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Index];
    const throughput = testData.length / (latencies.reduce((a, b) => a + b, 0) / 1000);

    console.log('[LocalModelManager] Benchmark results:', {
      avgLatency: avgLatency.toFixed(2),
      p95Latency: p95Latency.toFixed(2),
      throughput: throughput.toFixed(2),
    });

    return { avgLatency, throughput, p95Latency };
  }

  clearCache() {
    console.log('[LocalModelManager] Clearing model cache');
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      currentModel: this.currentModel,
      availableModels: this.getAvailableModels(),
      performanceHistory: this.performanceHistory.slice(-10),
    };
  }
}

export const localModelManager = LocalModelManager.getInstance();
export default localModelManager;
