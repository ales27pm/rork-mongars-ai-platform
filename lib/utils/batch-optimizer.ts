

export interface BatchConfig {
  maxBatchSize: number;
  minBatchSize: number;
  timeout: number;
  enableDynamicSizing: boolean;
}

export interface BatchItem<T> {
  id: string;
  data: T;
  priority: number;
  timestamp: number;
}

export interface BatchResult<R> {
  id: string;
  result?: R;
  error?: Error;
  duration: number;
}

export class BatchOptimizer<T, R> {
  private queue: BatchItem<T>[] = [];
  private processing = false;
  private config: BatchConfig;
  private processingTimer: ReturnType<typeof setTimeout> | null = null;
  private performanceHistory: number[] = [];
  
  constructor(config: Partial<BatchConfig> = {}) {
    this.config = {
      maxBatchSize: config.maxBatchSize ?? 8,
      minBatchSize: config.minBatchSize ?? 1,
      timeout: config.timeout ?? 100,
      enableDynamicSizing: config.enableDynamicSizing ?? true,
    };
  }
  
  async add(data: T, priority: number = 0): Promise<R> {
    const id = `${Date.now()}_${Math.random()}`;
    const item: BatchItem<T> = {
      id,
      data,
      priority,
      timestamp: Date.now(),
    };
    
    return new Promise((resolve, reject) => {
      this.queue.push(item);
      
      this.queue.sort((a, b) => b.priority - a.priority);
      
      const resultHandler = (result: BatchResult<R>) => {
        if (result.id === id) {
          if (result.error) {
            reject(result.error);
          } else {
            resolve(result.result as R);
          }
        }
      };
      
      item.timestamp = Date.now();
      (item as any).handler = resultHandler;
      
      this.scheduleProcessing();
    });
  }
  
  private scheduleProcessing() {
    if (this.processing) return;
    
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }
    
    const shouldProcessImmediately = 
      this.queue.length >= this.config.maxBatchSize ||
      this.queue.some(item => Date.now() - item.timestamp > this.config.timeout);
    
    if (shouldProcessImmediately) {
      this.processBatch();
    } else {
      this.processingTimer = setTimeout(() => {
        this.processBatch();
      }, this.config.timeout);
    }
  }
  
  private async processBatch() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    const batchSize = this.determineBatchSize();
    const batch = this.queue.splice(0, batchSize);
    
    console.log(`[BatchOptimizer] Processing batch of ${batch.length} items`);
    
    const startTime = Date.now();
    
    try {
      await Promise.resolve();
      
      const duration = Date.now() - startTime;
      this.recordPerformance(duration, batch.length);
      
      console.log(`[BatchOptimizer] Batch processed in ${duration}ms (${(duration / batch.length).toFixed(2)}ms per item)`);
    } catch (error) {
      console.error('[BatchOptimizer] Batch processing failed:', error);
    } finally {
      this.processing = false;
      
      if (this.queue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }
  
  private determineBatchSize(): number {
    if (!this.config.enableDynamicSizing) {
      return Math.min(this.queue.length, this.config.maxBatchSize);
    }
    
    if (this.performanceHistory.length < 3) {
      return Math.min(this.queue.length, this.config.maxBatchSize);
    }
    
    const recentPerf = this.performanceHistory.slice(-5);
    const avgLatency = recentPerf.reduce((a, b) => a + b, 0) / recentPerf.length;
    
    if (avgLatency < 50) {
      return Math.min(this.queue.length, this.config.maxBatchSize);
    } else if (avgLatency < 100) {
      return Math.min(this.queue.length, Math.floor(this.config.maxBatchSize * 0.75));
    } else {
      return Math.min(this.queue.length, Math.floor(this.config.maxBatchSize * 0.5));
    }
  }
  
  private recordPerformance(duration: number, batchSize: number) {
    const perItemLatency = duration / batchSize;
    this.performanceHistory.push(perItemLatency);
    
    if (this.performanceHistory.length > 20) {
      this.performanceHistory.shift();
    }
  }
  
  getQueueLength(): number {
    return this.queue.length;
  }
  
  isProcessing(): boolean {
    return this.processing;
  }
  
  getStats() {
    const avgLatency = this.performanceHistory.length > 0
      ? this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length
      : 0;
    
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      avgLatency: Math.round(avgLatency * 100) / 100,
      historySize: this.performanceHistory.length,
      currentBatchSize: this.determineBatchSize(),
    };
  }
  
  clear() {
    this.queue = [];
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
  }
}

export class EmbeddingBatchOptimizer {
  private queue: BatchItem<string>[] = [];
  private processing = false;
  private config: BatchConfig;
  private processingTimer: ReturnType<typeof setTimeout> | null = null;
  private performanceHistory: number[] = [];
  private encoder: (texts: string[]) => Promise<number[][]>;
  
  constructor(
    encoder: (texts: string[]) => Promise<number[][]>,
    config?: Partial<BatchConfig>
  ) {
    this.encoder = encoder;
    this.config = {
      maxBatchSize: config?.maxBatchSize ?? 8,
      minBatchSize: config?.minBatchSize ?? 1,
      timeout: config?.timeout ?? 100,
      enableDynamicSizing: config?.enableDynamicSizing ?? true,
    };
  }
  
  async encode(text: string, priority: number = 0): Promise<number[]> {
    const id = `${Date.now()}_${Math.random()}`;
    const item: BatchItem<string> = {
      id,
      data: text,
      priority,
      timestamp: Date.now(),
    };
    
    return new Promise((resolve, reject) => {
      this.queue.push(item);
      this.queue.sort((a, b) => b.priority - a.priority);
      
      (item as any).handler = (result: BatchResult<number[]>) => {
        if (result.error) {
          reject(result.error);
        } else {
          resolve(result.result as number[]);
        }
      };
      
      this.scheduleProcessing();
    });
  }
  
  private scheduleProcessing() {
    if (this.processing) return;
    
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }
    
    const shouldProcessImmediately = 
      this.queue.length >= this.config.maxBatchSize ||
      this.queue.some(item => Date.now() - item.timestamp > this.config.timeout);
    
    if (shouldProcessImmediately) {
      this.processBatch();
    } else {
      this.processingTimer = setTimeout(() => {
        this.processBatch();
      }, this.config.timeout);
    }
  }
  
  private async processBatch() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    const batchSize = Math.min(this.queue.length, this.config.maxBatchSize);
    const items = this.queue.splice(0, batchSize);
    
    const startTime = Date.now();
    
    try {
      const texts = items.map(item => item.data);
      const embeddings = await this.encoder(texts);
      
      const duration = Date.now() - startTime;
      
      items.forEach((item, idx) => {
        const handler = (item as any).handler;
        if (handler) {
          handler({
            id: item.id,
            result: embeddings[idx],
            duration: duration / items.length,
          });
        }
      });
      
      this.recordPerformance(duration, items.length);
      
      console.log(`[EmbeddingBatchOptimizer] Processed ${items.length} embeddings in ${duration}ms`);
    } catch (error) {
      console.error('[EmbeddingBatchOptimizer] Batch encoding failed:', error);
      
      items.forEach(item => {
        const handler = (item as any).handler;
        if (handler) {
          handler({
            id: item.id,
            error: error instanceof Error ? error : new Error(String(error)),
            duration: 0,
          });
        }
      });
    } finally {
      this.processing = false;
      
      if (this.queue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }
  
  private recordPerformance(duration: number, batchSize: number) {
    const perItemLatency = duration / batchSize;
    this.performanceHistory.push(perItemLatency);
    
    if (this.performanceHistory.length > 20) {
      this.performanceHistory.shift();
    }
  }
  
  getQueueLength(): number {
    return this.queue.length;
  }
  
  isProcessing(): boolean {
    return this.processing;
  }
  
  getStats() {
    const avgLatency = this.performanceHistory.length > 0
      ? this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length
      : 0;
    
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      avgLatency: Math.round(avgLatency * 100) / 100,
      historySize: this.performanceHistory.length,
    };
  }
  
  clear() {
    this.queue = [];
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
  }
}

export class MemoryAwareBatchProcessor {
  private maxMemoryUsage: number;
  private currentMemoryEstimate: number = 0;
  
  constructor(maxMemoryMB: number = 100) {
    this.maxMemoryUsage = maxMemoryMB * 1024 * 1024;
  }
  
  async processBatchWithMemoryLimit<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    estimateSize: (item: T) => number
  ): Promise<R[]> {
    const results: R[] = [];
    let currentBatch: T[] = [];
    let currentBatchSize = 0;
    
    for (const item of items) {
      const itemSize = estimateSize(item);
      
      if (currentBatchSize + itemSize > this.maxMemoryUsage && currentBatch.length > 0) {
        const batchResults = await processor(currentBatch);
        results.push(...batchResults);
        
        currentBatch = [];
        currentBatchSize = 0;
        
        await this.waitForMemoryCooldown();
      }
      
      currentBatch.push(item);
      currentBatchSize += itemSize;
    }
    
    if (currentBatch.length > 0) {
      const batchResults = await processor(currentBatch);
      results.push(...batchResults);
    }
    
    return results;
  }
  
  private async waitForMemoryCooldown() {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  getMemoryEstimate(): number {
    return this.currentMemoryEstimate;
  }
}
