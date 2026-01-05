export interface BatchConfig {
  maxBatchSize: number;
  maxConcurrency: number;
  retryAttempts: number;
  retryDelay: number;
  onProgress?: (completed: number, total: number) => void;
  onError?: (error: Error, item: any) => void;
}

export interface BatchResult<T, R> {
  successful: { item: T; result: R }[];
  failed: { item: T; error: Error }[];
  totalProcessed: number;
  totalFailed: number;
  duration: number;
}

export class BatchProcessor<T, R> {
  private config: Required<BatchConfig>;

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = {
      maxBatchSize: config.maxBatchSize || 8,
      maxConcurrency: config.maxConcurrency || 3,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      onProgress: config.onProgress || (() => {}),
      onError: config.onError || (() => {}),
    };
  }

  async process(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<BatchResult<T, R>> {
    const startTime = Date.now();
    const successful: { item: T; result: R }[] = [];
    const failed: { item: T; error: Error }[] = [];

    const batches = this.createBatches(items);
    let completed = 0;

    console.log(`[BatchProcessor] Processing ${items.length} items in ${batches.length} batches`);

    for (let i = 0; i < batches.length; i += this.config.maxConcurrency) {
      const concurrentBatches = batches.slice(i, i + this.config.maxConcurrency);
      
      const results = await Promise.allSettled(
        concurrentBatches.map(batch => this.processBatchWithRetry(batch, processor))
      );

      results.forEach((result, idx) => {
        const batch = concurrentBatches[idx];
        
        if (result.status === 'fulfilled') {
          const batchResults = result.value;
          batch.forEach((item, itemIdx) => {
            if (batchResults[itemIdx]) {
              successful.push({ item, result: batchResults[itemIdx] });
            }
          });
        } else {
          batch.forEach(item => {
            const error = result.reason instanceof Error 
              ? result.reason 
              : new Error(String(result.reason));
            failed.push({ item, error });
            this.config.onError(error, item);
          });
        }

        completed += batch.length;
        this.config.onProgress(completed, items.length);
      });

      await this.delay(100);
    }

    const duration = Date.now() - startTime;
    
    console.log(`[BatchProcessor] Completed: ${successful.length} successful, ${failed.length} failed in ${duration}ms`);

    return {
      successful,
      failed,
      totalProcessed: successful.length,
      totalFailed: failed.length,
      duration,
    };
  }

  async processStreaming(
    items: T[],
    processor: (item: T) => Promise<R>,
    onItemComplete?: (item: T, result: R) => void
  ): Promise<BatchResult<T, R>> {
    const startTime = Date.now();
    const successful: { item: T; result: R }[] = [];
    const failed: { item: T; error: Error }[] = [];

    console.log(`[BatchProcessor] Processing ${items.length} items with streaming`);

    for (let i = 0; i < items.length; i += this.config.maxConcurrency) {
      const batch = items.slice(i, i + this.config.maxConcurrency);
      
      const results = await Promise.allSettled(
        batch.map(item => this.processItemWithRetry(item, processor))
      );

      results.forEach((result, idx) => {
        const item = batch[idx];
        
        if (result.status === 'fulfilled') {
          successful.push({ item, result: result.value });
          onItemComplete?.(item, result.value);
        } else {
          const error = result.reason instanceof Error 
            ? result.reason 
            : new Error(String(result.reason));
          failed.push({ item, error });
          this.config.onError(error, item);
        }
      });

      this.config.onProgress(i + batch.length, items.length);
      
      await this.delay(50);
    }

    const duration = Date.now() - startTime;
    
    console.log(`[BatchProcessor] Streaming completed: ${successful.length} successful, ${failed.length} failed in ${duration}ms`);

    return {
      successful,
      failed,
      totalProcessed: successful.length,
      totalFailed: failed.length,
      duration,
    };
  }

  private async processBatchWithRetry(
    batch: T[],
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        if (attempt > 0) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt - 1));
          console.log(`[BatchProcessor] Retry attempt ${attempt + 1} for batch of ${batch.length}`);
        }

        return await processor(batch);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[BatchProcessor] Batch failed (attempt ${attempt + 1}):`, lastError.message);
      }
    }

    throw lastError || new Error('Batch processing failed');
  }

  private async processItemWithRetry(
    item: T,
    processor: (item: T) => Promise<R>
  ): Promise<R> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        if (attempt > 0) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt - 1));
          console.log(`[BatchProcessor] Retry attempt ${attempt + 1} for item`);
        }

        return await processor(item);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[BatchProcessor] Item failed (attempt ${attempt + 1}):`, lastError.message);
      }
    }

    throw lastError || new Error('Item processing failed');
  }

  private createBatches(items: T[]): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += this.config.maxBatchSize) {
      batches.push(items.slice(i, i + this.config.maxBatchSize));
    }
    
    return batches;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateConfig(config: Partial<BatchConfig>) {
    this.config = {
      ...this.config,
      ...config,
    };
    console.log('[BatchProcessor] Configuration updated:', this.config);
  }

  getConfig(): Required<BatchConfig> {
    return { ...this.config };
  }
}

export function createBatchProcessor<T, R>(config?: Partial<BatchConfig>): BatchProcessor<T, R> {
  return new BatchProcessor<T, R>(config);
}
