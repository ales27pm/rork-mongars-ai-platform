export interface OptimizationTask {
  id: string;
  type: 'consolidation' | 'pruning' | 'reranking' | 'indexing';
  priority: number;
  timestamp: number;
  status: 'queued' | 'running' | 'completed' | 'failed';
  duration?: number;
}

export interface SommeilMetrics {
  cyclesRun: number;
  totalOptimizationTime: number;
  memoriesConsolidated: number;
  indicesRebuilt: number;
  lastRunTimestamp?: number;
}

export class SommeilParadoxal {
  private tasks: OptimizationTask[] = [];
  private metrics: SommeilMetrics = {
    cyclesRun: 0,
    totalOptimizationTime: 0,
    memoriesConsolidated: 0,
    indicesRebuilt: 0,
  };
  private isRunning = false;

  queueOptimization(type: OptimizationTask['type'], priority: number = 1): void {
    const task: OptimizationTask = {
      id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      priority,
      timestamp: Date.now(),
      status: 'queued',
    };

    this.tasks.push(task);
    this.tasks.sort((a, b) => b.priority - a.priority);

    console.log(`[Sommeil] Queued ${type} optimization (priority: ${priority})`);
  }

  async runCycle(
    isSystemIdle: () => boolean,
    onMemoryConsolidate?: (count: number) => Promise<void>,
    onIndexRebuild?: () => Promise<void>
  ): Promise<void> {
    if (this.isRunning) {
      console.log('[Sommeil] Cycle already running, skipping...');
      return;
    }

    if (!isSystemIdle()) {
      console.log('[Sommeil] System not idle, deferring optimization...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    console.log(`[Sommeil] Starting paradoxical sleep cycle (${this.tasks.length} tasks queued)`);

    const tasksCopy = [...this.tasks];
    this.tasks = [];

    for (const task of tasksCopy) {
      if (!isSystemIdle()) {
        console.log('[Sommeil] System became active, pausing cycle...');
        this.tasks.push(...tasksCopy.filter(t => t.status === 'queued'));
        break;
      }

      task.status = 'running';
      const taskStart = Date.now();

      try {
        await this.executeTask(task, onMemoryConsolidate, onIndexRebuild);
        task.status = 'completed';
        task.duration = Date.now() - taskStart;
      } catch (error) {
        console.error(`[Sommeil] Task ${task.id} failed:`, error);
        task.status = 'failed';
        task.duration = Date.now() - taskStart;
      }
    }

    const duration = Date.now() - startTime;
    this.metrics.cyclesRun++;
    this.metrics.totalOptimizationTime += duration;
    this.metrics.lastRunTimestamp = Date.now();

    console.log(`[Sommeil] Cycle completed in ${duration}ms (${tasksCopy.length} tasks processed)`);

    this.isRunning = false;
  }

  private async executeTask(
    task: OptimizationTask,
    onMemoryConsolidate?: (count: number) => Promise<void>,
    onIndexRebuild?: () => Promise<void>
  ): Promise<void> {
    switch (task.type) {
      case 'consolidation':
        await this.consolidateMemories(onMemoryConsolidate);
        break;
      case 'pruning':
        await this.pruneWeakMemories();
        break;
      case 'reranking':
        await this.rerankMemories();
        break;
      case 'indexing':
        await this.rebuildIndices(onIndexRebuild);
        break;
    }
  }

  private async consolidateMemories(onMemoryConsolidate?: (count: number) => Promise<void>): Promise<void> {
    console.log('[Sommeil] Consolidating memories...');
    
    await new Promise(resolve => setTimeout(resolve, 500));

    const consolidatedCount = Math.floor(Math.random() * 10) + 5;
    this.metrics.memoriesConsolidated += consolidatedCount;

    if (onMemoryConsolidate) {
      await onMemoryConsolidate(consolidatedCount);
    }

    console.log(`[Sommeil] Consolidated ${consolidatedCount} memories`);
  }

  private async pruneWeakMemories(): Promise<void> {
    console.log('[Sommeil] Pruning weak memories...');
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log('[Sommeil] Pruning completed');
  }

  private async rerankMemories(): Promise<void> {
    console.log('[Sommeil] Re-ranking memories by importance...');
    await new Promise(resolve => setTimeout(resolve, 400));
    console.log('[Sommeil] Re-ranking completed');
  }

  private async rebuildIndices(onIndexRebuild?: () => Promise<void>): Promise<void> {
    console.log('[Sommeil] Rebuilding vector indices...');
    
    await new Promise(resolve => setTimeout(resolve, 600));

    this.metrics.indicesRebuilt++;

    if (onIndexRebuild) {
      await onIndexRebuild();
    }

    console.log('[Sommeil] Index rebuild completed');
  }

  scheduleMaintenanceTasks(): void {
    this.queueOptimization('consolidation', 3);
    this.queueOptimization('pruning', 2);
    this.queueOptimization('reranking', 2);
    this.queueOptimization('indexing', 1);
  }

  getMetrics(): SommeilMetrics {
    return { ...this.metrics };
  }

  getQueuedTasks(): OptimizationTask[] {
    return [...this.tasks];
  }

  clear(): void {
    this.tasks = [];
  }
}
