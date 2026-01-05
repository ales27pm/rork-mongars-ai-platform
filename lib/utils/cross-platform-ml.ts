import { Platform } from 'react-native';
import { dolphinCoreML } from '@/lib/modules/DolphinCoreML';
import { transformerEmbeddings } from '@/lib/utils/transformer-embeddings';

export interface MLConfig {
  modelName?: string;
  quantized?: boolean;
  enableEncryption?: boolean;
  maxBatchSize?: number;
}

export interface GenerationOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  repetitionPenalty?: number;
  stopSequences?: string[];
}

export interface EmbeddingOptions {
  normalize?: boolean;
  pooling?: 'mean' | 'max' | 'cls';
}

export class CrossPlatformMLService {
  private static instance: CrossPlatformMLService;
  private isInitialized = false;
  private platformBackend: 'coreml' | 'transformers' | 'onnx' = 'transformers';
  private modelCache = new Map<string, any>();

  private constructor() {
    this.detectPlatformBackend();
  }

  static getInstance(): CrossPlatformMLService {
    if (!CrossPlatformMLService.instance) {
      CrossPlatformMLService.instance = new CrossPlatformMLService();
    }
    return CrossPlatformMLService.instance;
  }

  private detectPlatformBackend() {
    if (Platform.OS === 'ios') {
      this.platformBackend = 'coreml';
      console.log('[CrossPlatformML] Using CoreML backend for iOS');
    } else if (Platform.OS === 'web' || Platform.OS === 'android') {
      this.platformBackend = 'transformers';
      console.log(`[CrossPlatformML] Using Transformers.js backend for ${Platform.OS}`);
    } else {
      this.platformBackend = 'transformers';
      console.log('[CrossPlatformML] Using Transformers.js fallback backend');
    }
  }

  async initialize(config: MLConfig = {}): Promise<boolean> {
    if (this.isInitialized) {
      console.log('[CrossPlatformML] Already initialized');
      return true;
    }

    console.log('[CrossPlatformML] Initializing with backend:', this.platformBackend);

    try {
      if (this.platformBackend === 'coreml') {
        await dolphinCoreML.initialize({
          modelName: config.modelName || 'Dolphin',
          enableEncryption: config.enableEncryption !== false,
          maxBatchSize: config.maxBatchSize || 8,
          computeUnits: 'all',
        });
      } else if (this.platformBackend === 'transformers') {
        await transformerEmbeddings.initialize('all-MiniLM-L6-v2');
      }

      this.isInitialized = true;
      console.log('[CrossPlatformML] Initialization successful');
      return true;
    } catch (error) {
      console.error('[CrossPlatformML] Initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  async generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const cacheKey = `emb_${text.substring(0, 100)}_${JSON.stringify(options)}`;
    if (this.modelCache.has(cacheKey)) {
      console.log('[CrossPlatformML] Using cached embedding');
      return this.modelCache.get(cacheKey);
    }

    try {
      let embedding: number[];

      if (this.platformBackend === 'coreml') {
        const pooling = options?.pooling === 'max' ? 'mean' : (options?.pooling || 'mean');
        embedding = await dolphinCoreML.encode(text, {
          normalize: options?.normalize !== false,
          pooling,
        });
      } else if (this.platformBackend === 'transformers') {
        const pooling = options?.pooling === 'max' ? 'mean' : (options?.pooling || 'mean');
        embedding = await transformerEmbeddings.encode(text, {
          normalize: options?.normalize !== false,
          pooling,
        });
      } else {
        embedding = this.generateFallbackEmbedding(text);
      }

      if (this.modelCache.size > 100) {
        const firstKey = this.modelCache.keys().next().value;
        if (firstKey) {
          this.modelCache.delete(firstKey);
        }
      }
      this.modelCache.set(cacheKey, embedding);

      return embedding;
    } catch (error) {
      console.error('[CrossPlatformML] Embedding generation failed:', error);
      return this.generateFallbackEmbedding(text);
    }
  }

  async generateBatchEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`[CrossPlatformML] Generating batch embeddings for ${texts.length} texts`);

    try {
      if (this.platformBackend === 'coreml') {
        const pooling = options?.pooling === 'max' ? 'mean' : (options?.pooling || 'mean');
        return await dolphinCoreML.encodeBatch(texts, {
          normalize: options?.normalize !== false,
          pooling,
        });
      } else if (this.platformBackend === 'transformers') {
        const pooling = options?.pooling === 'max' ? 'mean' : (options?.pooling || 'mean');
        return await transformerEmbeddings.encodeBatch(texts, {
          normalize: options?.normalize !== false,
          pooling,
        });
      } else {
        return texts.map(text => this.generateFallbackEmbedding(text));
      }
    } catch (error) {
      console.error('[CrossPlatformML] Batch embedding generation failed:', error);
      return texts.map(text => this.generateFallbackEmbedding(text));
    }
  }

  async generateText(prompt: string, options?: GenerationOptions): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('[CrossPlatformML] Generating text with backend:', this.platformBackend);

    try {
      if (this.platformBackend === 'coreml') {
        return await dolphinCoreML.generate(prompt, {
          maxTokens: options?.maxTokens || 100,
          temperature: options?.temperature || 0.7,
          topP: options?.topP || 0.9,
          repetitionPenalty: options?.repetitionPenalty || 1.1,
          stopSequences: options?.stopSequences || [],
        });
      } else {
        console.warn('[CrossPlatformML] Text generation not supported on', Platform.OS);
        return `[Text generation is optimized for iOS. Platform: ${Platform.OS}]`;
      }
    } catch (error) {
      console.error('[CrossPlatformML] Text generation failed:', error);
      throw error;
    }
  }

  async computeSimilarity(text1: string, text2: string): Promise<number> {
    const [emb1, emb2] = await Promise.all([
      this.generateEmbedding(text1),
      this.generateEmbedding(text2),
    ]);

    return this.cosineSimilarity(emb1, emb2);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      console.warn('[CrossPlatformML] Embedding dimension mismatch');
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private generateFallbackEmbedding(text: string, dimension: number = 384): number[] {
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

    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / magnitude);
  }

  getBackendInfo(): {
    platform: string;
    backend: string;
    initialized: boolean;
    capabilities: string[];
  } {
    const capabilities: string[] = ['embeddings'];

    if (this.platformBackend === 'coreml') {
      capabilities.push('text-generation', 'chat');
    }

    return {
      platform: Platform.OS,
      backend: this.platformBackend,
      initialized: this.isInitialized,
      capabilities,
    };
  }

  clearCache(): void {
    this.modelCache.clear();
    console.log('[CrossPlatformML] Cache cleared');
  }

  async cleanup(): Promise<void> {
    this.modelCache.clear();

    if (this.platformBackend === 'transformers') {
      await transformerEmbeddings.cleanup();
    }

    this.isInitialized = false;
    console.log('[CrossPlatformML] Cleanup complete');
  }
}

export const crossPlatformML = CrossPlatformMLService.getInstance();
export default crossPlatformML;
