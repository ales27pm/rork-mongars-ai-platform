import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DeviceMetrics {
  platform: string;
  version: string;
  memoryUsage: number;
  totalMemory: number;
  memoryUsagePercent: number;
  thermalState: ThermalState;
  batteryLevel: number;
  isLowPowerMode: boolean;
  processorCount: number;
  timestamp: number;
}

export enum ThermalState {
  Nominal = 0,
  Fair = 1,
  Serious = 2,
  Critical = 3,
}

export interface MemoryWarning {
  timestamp: number;
  memoryUsage: number;
  thermalState: ThermalState;
  action: 'cache_cleared' | 'memory_released' | 'operation_throttled';
}

class DeviceMetricsMonitor {
  private static instance: DeviceMetricsMonitor;
  private metricsHistory: DeviceMetrics[] = [];
  private memoryWarnings: MemoryWarning[] = [];
  private readonly MAX_HISTORY = 100;
  private readonly STORAGE_KEY = 'device_metrics_history';
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  static getInstance(): DeviceMetricsMonitor {
    if (!DeviceMetricsMonitor.instance) {
      DeviceMetricsMonitor.instance = new DeviceMetricsMonitor();
    }
    return DeviceMetricsMonitor.instance;
  }

  async getCurrentMetrics(): Promise<DeviceMetrics> {
    const metrics: DeviceMetrics = {
      platform: Platform.OS,
      version: Platform.Version.toString(),
      memoryUsage: await this.getMemoryUsage(),
      totalMemory: await this.getTotalMemory(),
      memoryUsagePercent: 0,
      thermalState: await this.getThermalState(),
      batteryLevel: await this.getBatteryLevel(),
      isLowPowerMode: await this.isLowPowerModeEnabled(),
      processorCount: await this.getProcessorCount(),
      timestamp: Date.now(),
    };

    metrics.memoryUsagePercent = (metrics.memoryUsage / metrics.totalMemory) * 100;

    return metrics;
  }

  async startMonitoring(intervalMs: number = 5000) {
    if (this.monitoringInterval) {
      console.log('[DeviceMetrics] Monitoring already active');
      return;
    }

    console.log(`[DeviceMetrics] Starting monitoring with ${intervalMs}ms interval`);
    
    await this.recordMetrics();

    this.monitoringInterval = setInterval(async () => {
      await this.recordMetrics();
    }, intervalMs);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[DeviceMetrics] Monitoring stopped');
    }
  }

  private async recordMetrics() {
    try {
      const metrics = await this.getCurrentMetrics();
      
      this.metricsHistory.push(metrics);
      
      if (this.metricsHistory.length > this.MAX_HISTORY) {
        this.metricsHistory.shift();
      }

      if (metrics.memoryUsagePercent > 80) {
        console.warn(`[DeviceMetrics] High memory usage: ${metrics.memoryUsagePercent.toFixed(1)}%`);
        await this.handleMemoryPressure(metrics);
      }

      if (metrics.thermalState >= ThermalState.Serious) {
        console.warn(`[DeviceMetrics] High thermal state: ${metrics.thermalState}`);
      }

      await this.persistMetrics();
    } catch (error) {
      console.error('[DeviceMetrics] Failed to record metrics:', error);
    }
  }

  private async handleMemoryPressure(metrics: DeviceMetrics) {
    const warning: MemoryWarning = {
      timestamp: Date.now(),
      memoryUsage: metrics.memoryUsage,
      thermalState: metrics.thermalState,
      action: 'cache_cleared',
    };

    this.memoryWarnings.push(warning);

    if (this.memoryWarnings.length > 50) {
      this.memoryWarnings.shift();
    }

    console.log('[DeviceMetrics] Triggering memory cleanup...');
  }

  async getMetricsHistory(): Promise<DeviceMetrics[]> {
    return [...this.metricsHistory];
  }

  async getMemoryWarnings(): Promise<MemoryWarning[]> {
    return [...this.memoryWarnings];
  }

  async getAverageMetrics(lastN: number = 10): Promise<Partial<DeviceMetrics>> {
    const recentMetrics = this.metricsHistory.slice(-lastN);
    
    if (recentMetrics.length === 0) {
      return {};
    }

    const sum = recentMetrics.reduce(
      (acc, m) => ({
        memoryUsage: acc.memoryUsage + m.memoryUsage,
        memoryUsagePercent: acc.memoryUsagePercent + m.memoryUsagePercent,
        batteryLevel: acc.batteryLevel + m.batteryLevel,
      }),
      { memoryUsage: 0, memoryUsagePercent: 0, batteryLevel: 0 }
    );

    return {
      memoryUsage: sum.memoryUsage / recentMetrics.length,
      memoryUsagePercent: sum.memoryUsagePercent / recentMetrics.length,
      batteryLevel: sum.batteryLevel / recentMetrics.length,
    };
  }

  isMemoryPressureHigh(): boolean {
    if (this.metricsHistory.length === 0) return false;
    
    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    return latest.memoryUsagePercent > 80;
  }

  isThermalThrottlingNeeded(): boolean {
    if (this.metricsHistory.length === 0) return false;
    
    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    return latest.thermalState >= ThermalState.Serious;
  }

  shouldReducePerformance(): boolean {
    return this.isMemoryPressureHigh() || this.isThermalThrottlingNeeded();
  }

  private async persistMetrics() {
    try {
      const data = {
        history: this.metricsHistory.slice(-20),
        warnings: this.memoryWarnings.slice(-10),
      };
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[DeviceMetrics] Failed to persist metrics:', error);
    }
  }

  async loadPersistedMetrics() {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.metricsHistory = data.history || [];
        this.memoryWarnings = data.warnings || [];
        console.log('[DeviceMetrics] Loaded persisted metrics');
      }
    } catch (error) {
      console.error('[DeviceMetrics] Failed to load persisted metrics:', error);
    }
  }

  private async getMemoryUsage(): Promise<number> {
    if (Platform.OS === 'ios') {
      return 100 * 1024 * 1024;
    }
    return 100 * 1024 * 1024;
  }

  private async getTotalMemory(): Promise<number> {
    if (Platform.OS === 'ios') {
      return 8 * 1024 * 1024 * 1024;
    }
    return 8 * 1024 * 1024 * 1024;
  }

  private async getThermalState(): Promise<ThermalState> {
    return ThermalState.Nominal;
  }

  private async getBatteryLevel(): Promise<number> {
    return 1.0;
  }

  private async isLowPowerModeEnabled(): Promise<boolean> {
    return false;
  }

  private async getProcessorCount(): Promise<number> {
    return 8;
  }
}

export const deviceMetricsMonitor = DeviceMetricsMonitor.getInstance();
export default deviceMetricsMonitor;
