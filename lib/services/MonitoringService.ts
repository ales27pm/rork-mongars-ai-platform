import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface InferenceMetrics {
  type: 'encoding' | 'generation';
  duration: number;
  batchSize: number;
  success: boolean;
  memoryUsage?: number;
  thermalState?: string;
  timestamp: number;
}

export interface PerformanceReport {
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
  successRate: number;
  totalInferences: number;
}

class MonitoringService {
  private static instance: MonitoringService;
  private readonly RECENT_INFERENCES_KEY = 'recent_inferences';
  private readonly ERRORS_KEY = 'errors';
  private readonly MAX_INFERENCES = 100;
  private readonly MAX_ERRORS = 50;
  
  private constructor() {}
  
  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }
  
  async trackInference(metrics: Omit<InferenceMetrics, 'timestamp'>) {
    const timestamp = Date.now();
    const fullMetrics: InferenceMetrics = { ...metrics, timestamp };
    
    try {
      const recentStr = await AsyncStorage.getItem(this.RECENT_INFERENCES_KEY);
      const recent: InferenceMetrics[] = recentStr ? JSON.parse(recentStr) : [];
      
      recent.push(fullMetrics);
      
      if (recent.length > this.MAX_INFERENCES) {
        recent.splice(0, recent.length - this.MAX_INFERENCES);
      }
      
      await AsyncStorage.setItem(this.RECENT_INFERENCES_KEY, JSON.stringify(recent));
      
      console.log(`[Monitoring] Tracked ${metrics.type} inference: ${metrics.duration}ms, batch: ${metrics.batchSize}, success: ${metrics.success}`);
    } catch (error) {
      console.error('[Monitoring] Failed to track inference:', error);
    }
  }
  
  async trackError(error: Error, context?: Record<string, any>) {
    try {
      const errorsStr = await AsyncStorage.getItem(this.ERRORS_KEY);
      const errors: any[] = errorsStr ? JSON.parse(errorsStr) : [];
      
      errors.push({
        timestamp: Date.now(),
        message: error.message,
        stack: error.stack,
        context,
        platform: Platform.OS
      });
      
      if (errors.length > this.MAX_ERRORS) {
        errors.splice(0, errors.length - this.MAX_ERRORS);
      }
      
      await AsyncStorage.setItem(this.ERRORS_KEY, JSON.stringify(errors));
      
      console.error('[Monitoring] Tracked error:', error.message, context);
    } catch (err) {
      console.error('[Monitoring] Failed to track error:', err);
    }
  }
  
  async getPerformanceReport(): Promise<PerformanceReport> {
    try {
      const recentStr = await AsyncStorage.getItem(this.RECENT_INFERENCES_KEY);
      const recent: InferenceMetrics[] = recentStr ? JSON.parse(recentStr) : [];
      
      const encodingMetrics = recent.filter(r => r.type === 'encoding');
      const generationMetrics = recent.filter(r => r.type === 'generation');
      
      return {
        encoding: this.calculateStats(encodingMetrics),
        generation: this.calculateStats(generationMetrics),
        successRate: this.calculateSuccessRate(recent),
        totalInferences: recent.length
      };
    } catch (error) {
      console.error('[Monitoring] Failed to get performance report:', error);
      return {
        successRate: 0,
        totalInferences: 0
      };
    }
  }
  
  async getRecentErrors(): Promise<any[]> {
    try {
      const errorsStr = await AsyncStorage.getItem(this.ERRORS_KEY);
      return errorsStr ? JSON.parse(errorsStr) : [];
    } catch (error) {
      console.error('[Monitoring] Failed to get recent errors:', error);
      return [];
    }
  }
  
  async clearData() {
    try {
      await AsyncStorage.multiRemove([this.RECENT_INFERENCES_KEY, this.ERRORS_KEY]);
      console.log('[Monitoring] Cleared all monitoring data');
    } catch (error) {
      console.error('[Monitoring] Failed to clear data:', error);
    }
  }
  
  private calculateStats(metrics: InferenceMetrics[]) {
    if (!metrics.length) return undefined;
    
    const durations = metrics.map(m => m.duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    
    return {
      average: Math.round(avg * 100) / 100,
      median: Math.round(median * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      count: durations.length
    };
  }
  
  private calculateSuccessRate(metrics: InferenceMetrics[]): number {
    if (!metrics.length) return 0;
    
    const successCount = metrics.filter(m => m.success).length;
    return Math.round((successCount / metrics.length) * 10000) / 100;
  }
}

export const monitoringService = MonitoringService.getInstance();
export default monitoringService;
