import { Platform } from 'react-native';
import NativeLLM, { embed, generate, loadModel, unloadModel } from '@/lib/modules/NativeLLM';

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
  private implementation: 'coreml' | 'transformers' | 'fallback' = 'fallback';
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
      this.implementation = 'native-llm';
      console.log('[CrossPlatformML] Using NativeLLM backend for iOS');
    } else {
      this.implementation = 'fallback';
      console.log(`[CrossPlatformML] Using on-device fallback for ${Platform.OS}`);
    }
  }

  async initialize(config: MLConfig = {}): Promise<boolean> {
    if (this.isInitialized) {
      console.log('[CrossPlatformML] Already initialized');
      return true;
    }

    console.log(`[CrossPlatformML] Initializing for platform: ${Platform.OS}`);

    try {
      if (Platform.OS === 'ios') {
        await this.initializeIOS();
      } else {
        console.log('[CrossPlatformML] Initializing Transformers for real embeddings');
        await this.initializeTransformers();
        this.implementation = 'transformers';
      }

      this.isInitialized = true;
      console.log(`[CrossPlatformML] ✓ Initialized with ${this.implementation} implementation`);
      return true;
    } catch (error) {
      console.error('[CrossPlatformML] Initialization failed:', error);
      console.log('[CrossPlatformML] Falling back to deterministic embeddings');
      this.implementation = 'fallback';
      this.isInitialized = true;
      return true;
    }
  }

  private async initializeIOS(): Promise<void> {
    console.log('[CrossPlatformML] Initializing NativeLLM for iOS');
    try {
      // You may want to pass a real modelPath here
      await loadModel({ modelPath: 'MODEL_PATH_HERE' });
      this.implementation = 'native-llm';
      console.log('[CrossPlatformML] NativeLLM initialized successfully');
    } catch (error) {
      console.error('[CrossPlatformML] NativeLLM initialization failed:', error);
      throw error;
    }
  }

  private async initializeTransformers(): Promise<void> {
    console.log('[CrossPlatformML] Initializing Transformers for Android/Web');
    const { transformerEmbeddings } = await import('@/lib/utils/transformer-embeddings');
    await transformerEmbeddings.initialize('all-MiniLM-L6-v2', true);
    console.log('[CrossPlatformML] ✓ Transformers initialized successfully');
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

      switch (this.implementation) {
        case 'native-llm':
          console.log('[CrossPlatformML] Using NativeLLM for embedding');
          const result = await embed(text);
          embedding = result.vector;
          break;
        case 'transformers':
          console.log('[CrossPlatformML] Using Transformers for embedding');
          const { transformerEmbeddings } = await import('@/lib/utils/transformer-embeddings');
          const transformerPooling = (options?.pooling === 'max' ? 'mean' : options?.pooling) || 'mean';
          embedding = await transformerEmbeddings.encode(text, {
            normalize: options?.normalize !== false,
            pooling: transformerPooling as 'mean' | 'cls',
          });
          break;
        default:
          embedding = this.generateFallbackEmbedding(text, options?.normalize !== false);
          break;
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
      const batchSize = 8;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        let batchResults: number[][];

        switch (this.implementation) {
          case 'native-llm':
            batchResults = await Promise.all(batch.map(async text => {
              const result = await embed(text);
              return result.vector;
            }));
            break;
          case 'transformers':
            console.log('[CrossPlatformML] Using Transformers for batch embeddings');
            const { transformerEmbeddings } = await import('@/lib/utils/transformer-embeddings');
            const batchPooling = (options?.pooling === 'max' ? 'mean' : options?.pooling) || 'mean';
            batchResults = await transformerEmbeddings.encodeBatch(batch, {
              normalize: options?.normalize !== false,
              pooling: batchPooling as 'mean' | 'cls',
            });
            break;
          default:
            batchResults = batch.map(text => this.generateFallbackEmbedding(text, options?.normalize !== false));
            break;
        }

        results.push(...batchResults);
      }

      return results;
    } catch (error) {
      console.error('[CrossPlatformML] Batch embedding generation failed:', error);
      return texts.map(text => this.generateFallbackEmbedding(text));
    }
  }

  async generateText(prompt: string, options?: GenerationOptions): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('[CrossPlatformML] Generating text with backend:', this.implementation);

    try {
      if (this.implementation === 'native-llm') {
        // NativeLLM's generate returns a requestId, actual output is via event listener
        const { requestId } = await generate({
          prompt,
          maxTokens: options?.maxTokens || 100,
          temperature: options?.temperature || 0.7,
        });
        // You will need to listen for the output event elsewhere
        return `[NativeLLM request started: ${requestId}]`;
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

  private generateFallbackEmbedding(text: string, normalize: boolean = true): number[] {
    const dimension = 384;
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

    if (normalize) {
      const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
      return embedding.map(v => v / magnitude);
    }
    
    return embedding;
  }

  getBackendInfo(): {
    platform: string;
    backend: string;
    initialized: boolean;
    capabilities: string[];
  } {
    const capabilities: string[] = ['embeddings'];

    if (this.implementation === 'coreml') {
      capabilities.push('text-generation', 'chat');
    }

    return {
      platform: Platform.OS,
      backend: this.implementation,
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
    this.isInitialized = false;
    console.log('[CrossPlatformML] Cleanup complete');
  }
}

export const crossPlatformML = CrossPlatformMLService.getInstance();
export default crossPlatformML;
