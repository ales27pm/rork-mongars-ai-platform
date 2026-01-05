import { Platform } from 'react-native';

export interface TransformerModel {
  name: string;
  dimension: number;
  maxLength: number;
}

export const MODELS = {
  'all-MiniLM-L6-v2': {
    name: 'Xenova/all-MiniLM-L6-v2',
    dimension: 384,
    maxLength: 512,
  },
  'all-mpnet-base-v2': {
    name: 'Xenova/all-mpnet-base-v2',
    dimension: 768,
    maxLength: 512,
  },
} as const;

export class TransformerEmbeddingService {
  private static instance: TransformerEmbeddingService;
  private pipeline: any = null;
  private isInitialized = false;
  private isInitializing = false;
  private modelConfig: TransformerModel;
  private webWorker: Worker | null = null;

  private constructor() {
    this.modelConfig = MODELS['all-MiniLM-L6-v2'];
  }

  static getInstance(): TransformerEmbeddingService {
    if (!TransformerEmbeddingService.instance) {
      TransformerEmbeddingService.instance = new TransformerEmbeddingService();
    }
    return TransformerEmbeddingService.instance;
  }

  async initialize(modelName: keyof typeof MODELS = 'all-MiniLM-L6-v2'): Promise<boolean> {
    if (this.isInitialized) {
      console.log('[TransformerEmbeddings] Already initialized');
      return true;
    }

    if (this.isInitializing) {
      console.log('[TransformerEmbeddings] Initialization in progress, waiting...');
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.isInitialized;
    }

    this.isInitializing = true;
    this.modelConfig = MODELS[modelName];

    console.log(`[TransformerEmbeddings] Initializing ${this.modelConfig.name}...`);

    try {
      if (Platform.OS === 'web' || Platform.OS === 'android') {
        await this.initializeWeb();
      } else {
        console.warn('[TransformerEmbeddings] Platform not supported, using fallback');
        this.isInitialized = true;
      }

      console.log('[TransformerEmbeddings] Initialization complete');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[TransformerEmbeddings] Initialization failed:', error);
      this.isInitialized = false;
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  private async initializeWeb(): Promise<void> {
    try {
      const transformers = await import('@xenova/transformers');
      const { pipeline, env } = transformers;
      
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      
      if (Platform.OS === 'web') {
        env.backends.onnx.wasm.numThreads = 1;
      }
      
      console.log('[TransformerEmbeddings] Loading pipeline for', this.modelConfig.name);
      
      this.pipeline = await pipeline(
        'feature-extraction',
        this.modelConfig.name,
        { 
          quantized: true,
          revision: 'main',
          progress_callback: (progress: any) => {
            if (progress.status === 'progress' && progress.file) {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              console.log(`[TransformerEmbeddings] Downloading ${progress.file}: ${percent}%`);
            } else if (progress.status === 'done') {
              console.log(`[TransformerEmbeddings] Downloaded ${progress.file}`);
            }
          }
        }
      );

      console.log('[TransformerEmbeddings] Pipeline loaded successfully');
      
      const testEmbedding = await this.pipeline('test', { pooling: 'mean', normalize: true });
      console.log('[TransformerEmbeddings] Test encoding successful, dimension:', testEmbedding.data.length);
    } catch (error) {
      console.error('[TransformerEmbeddings] Web initialization failed:', error);
      throw error;
    }
  }

  async encode(text: string, options?: { normalize?: boolean; pooling?: 'mean' | 'cls' }): Promise<number[]> {
    if (!this.isInitialized) {
      console.warn('[TransformerEmbeddings] Not initialized, initializing now...');
      const success = await this.initialize();
      if (!success) {
        console.warn('[TransformerEmbeddings] Initialization failed, using fallback');
        return this.generateFallbackEmbedding(text);
      }
    }

    if ((Platform.OS !== 'web' && Platform.OS !== 'android') || !this.pipeline) {
      return this.generateFallbackEmbedding(text);
    }

    try {
      const startTime = Date.now();
      
      const maxLength = this.modelConfig.maxLength;
      const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;
      
      const output = await this.pipeline(truncatedText, {
        pooling: options?.pooling || 'mean',
        normalize: options?.normalize !== false,
      });

      let embedding: number[];
      if (output.data) {
        embedding = Array.from(output.data) as number[];
      } else if (Array.isArray(output)) {
        embedding = output as number[];
      } else {
        throw new Error('Unexpected output format from pipeline');
      }

      const duration = Date.now() - startTime;

      console.log(`[TransformerEmbeddings] Encoded text (${truncatedText.length} chars) in ${duration}ms, dim: ${embedding.length}`);

      return embedding;
    } catch (error) {
      console.error('[TransformerEmbeddings] Encoding failed:', error);
      return this.generateFallbackEmbedding(text);
    }
  }

  async encodeBatch(
    texts: string[], 
    options?: { normalize?: boolean; pooling?: 'mean' | 'cls'; batchSize?: number }
  ): Promise<number[][]> {
    if (!this.isInitialized) {
      console.warn('[TransformerEmbeddings] Not initialized, initializing now...');
      const success = await this.initialize();
      if (!success) {
        throw new Error('Failed to initialize transformer embeddings');
      }
    }

    if ((Platform.OS !== 'web' && Platform.OS !== 'android') || !this.pipeline) {
      return texts.map(text => this.generateFallbackEmbedding(text));
    }

    const batchSize = options?.batchSize || 8;
    const results: number[][] = [];

    console.log(`[TransformerEmbeddings] Encoding batch of ${texts.length} texts`);
    const startTime = Date.now();

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const batchResults = await Promise.all(
          batch.map(text => this.encode(text, options))
        );
        
        results.push(...batchResults);
      } catch (error) {
        console.error(`[TransformerEmbeddings] Batch ${i / batchSize + 1} failed:`, error);
        results.push(...batch.map(text => this.generateFallbackEmbedding(text)));
      }

      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const duration = Date.now() - startTime;
    console.log(`[TransformerEmbeddings] Batch encoding completed in ${duration}ms (${(duration / texts.length).toFixed(2)}ms per text)`);

    return results;
  }

  private generateFallbackEmbedding(text: string): number[] {
    const dimension = this.modelConfig.dimension;
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

  async similarity(text1: string, text2: string): Promise<number> {
    const [emb1, emb2] = await Promise.all([
      this.encode(text1),
      this.encode(text2),
    ]);

    return this.cosineSimilarity(emb1, emb2);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  getModelInfo(): TransformerModel & { initialized: boolean } {
    return {
      ...this.modelConfig,
      initialized: this.isInitialized,
    };
  }

  async cleanup(): Promise<void> {
    if (this.webWorker) {
      this.webWorker.terminate();
      this.webWorker = null;
    }
    
    this.pipeline = null;
    this.isInitialized = false;
    console.log('[TransformerEmbeddings] Cleaned up resources');
  }
}

export const transformerEmbeddings = TransformerEmbeddingService.getInstance();
export default transformerEmbeddings;
