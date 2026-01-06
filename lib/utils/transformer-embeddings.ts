

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

  async initialize(modelName: keyof typeof MODELS = 'all-MiniLM-L6-v2', enableRealModel = true): Promise<boolean> {
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

    if (!enableRealModel) {
      console.log('[TransformerEmbeddings] Real model disabled, using fallback embeddings');
      this.isInitialized = true;
      this.isInitializing = false;
      return true;
    }

    console.log(`[TransformerEmbeddings] Initializing ${this.modelConfig.name}`);

    try {
      const { pipeline, env } = await import('@xenova/transformers');
      
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      
      console.log('[TransformerEmbeddings] Loading transformer pipeline...');
      
      this.pipeline = await pipeline('feature-extraction', this.modelConfig.name, {
        progress_callback: (progress: any) => {
          if (progress.status === 'progress') {
            console.log(`[TransformerEmbeddings] Download progress: ${Math.round(progress.progress || 0)}%`);
          } else if (progress.status === 'done') {
            console.log(`[TransformerEmbeddings] Downloaded: ${progress.file}`);
          }
        },
      });
      
      this.isInitialized = true;
      console.log('[TransformerEmbeddings] Initialization complete with real model');
      return true;
    } catch (error) {
      console.error('[TransformerEmbeddings] Initialization failed:', error);
      console.log('[TransformerEmbeddings] Falling back to deterministic embeddings');
      this.isInitialized = true;
      return true;
    } finally {
      this.isInitializing = false;
    }
  }

  private async initializeWeb(): Promise<void> {
    console.log('[TransformerEmbeddings] On-device mode: external model loading disabled');
    console.log('[TransformerEmbeddings] Using deterministic fallback embeddings');
  }

  async encode(text: string, options?: { normalize?: boolean; pooling?: 'mean' | 'cls' }): Promise<number[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.pipeline) {
      console.log('[TransformerEmbeddings] Pipeline not available, using fallback');
      return this.generateFallbackEmbedding(text);
    }

    try {
      const result = await this.pipeline(text, {
        pooling: options?.pooling || 'mean',
        normalize: options?.normalize !== false,
      });

      const embedding = Array.from(result.data) as number[];
      return embedding;
    } catch (error) {
      console.error('[TransformerEmbeddings] Encoding failed, using fallback:', error);
      return this.generateFallbackEmbedding(text);
    }
  }

  async encodeBatch(
    texts: string[], 
    options?: { normalize?: boolean; pooling?: 'mean' | 'cls'; batchSize?: number }
  ): Promise<number[][]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.pipeline) {
      console.log('[TransformerEmbeddings] Pipeline not available, using fallback for batch');
      return texts.map(text => this.generateFallbackEmbedding(text));
    }

    console.log(`[TransformerEmbeddings] Encoding batch of ${texts.length} texts`);
    const batchSize = options?.batchSize || 8;
    const results: number[][] = [];

    try {
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(text => this.encode(text, options))
        );
        results.push(...batchResults);
      }
      return results;
    } catch (error) {
      console.error('[TransformerEmbeddings] Batch encoding failed, using fallback:', error);
      return texts.map(text => this.generateFallbackEmbedding(text));
    }
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
