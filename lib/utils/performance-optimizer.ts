import AsyncStorage from '@react-native-async-storage/async-storage';
import { deviceMetricsMonitor, ThermalState } from './device-metrics';

export interface PerformanceProfile {
  name: 'high' | 'balanced' | 'power_saver' | 'thermal_throttled';
  maxBatchSize: number;
  maxConcurrency: number;
  enableCaching: boolean;
  compressionLevel: number;
  inferenceTimeout: number;
}

export interface OptimizationMetrics {
  currentProfile: PerformanceProfile;
  memoryUsage: number;
  thermalState: ThermalState;
  batteryLevel: number;
  optimizationsSuggested: string[];
}

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private currentProfile: PerformanceProfile;
  private cache: Map<string, any> = new Map();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly STORAGE_KEY = 'performance_profile';

  private readonly profiles: Record<string, PerformanceProfile> = {
    high: {
      name: 'high',
      maxBatchSize: 16,
      maxConcurrency: 4,
      enableCaching: true,
      compressionLevel: 1,
      inferenceTimeout: 10000,
    },
    balanced: {
      name: 'balanced',
      maxBatchSize: 8,
      maxConcurrency: 3,
      enableCaching: true,
      compressionLevel: 2,
      inferenceTimeout: 5000,
    },
    power_saver: {
      name: 'power_saver',
      maxBatchSize: 4,
      maxConcurrency: 2,
      enableCaching: true,
      compressionLevel: 3,
      inferenceTimeout: 3000,
    },
    thermal_throttled: {
      name: 'thermal_throttled',
      maxBatchSize: 2,
      maxConcurrency: 1,
      enableCaching: false,
      compressionLevel: 3,
      inferenceTimeout: 2000,
    },
  };

  private constructor() {
    this.currentProfile = this.profiles.balanced;
    this.loadSavedProfile();
  }

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  async autoOptimize(): Promise<PerformanceProfile> {
    const metrics = await deviceMetricsMonitor.getCurrentMetrics();
    
    console.log('[PerformanceOptimizer] Current metrics:', {
      memory: `${metrics.memoryUsagePercent.toFixed(1)}%`,
      thermal: ThermalState[metrics.thermalState],
      battery: `${(metrics.batteryLevel * 100).toFixed(0)}%`,
      lowPower: metrics.isLowPowerMode,
    });

    let selectedProfile: PerformanceProfile;

    if (metrics.thermalState >= ThermalState.Serious) {
      selectedProfile = this.profiles.thermal_throttled;
      console.log('[PerformanceOptimizer] High thermal state detected, switching to thermal_throttled');
    } else if (metrics.isLowPowerMode || metrics.batteryLevel < 0.2) {
      selectedProfile = this.profiles.power_saver;
      console.log('[PerformanceOptimizer] Low power mode or low battery, switching to power_saver');
    } else if (metrics.memoryUsagePercent > 80) {
      selectedProfile = this.profiles.balanced;
      console.log('[PerformanceOptimizer] High memory usage, switching to balanced');
    } else if (metrics.batteryLevel > 0.8 && metrics.thermalState === ThermalState.Nominal) {
      selectedProfile = this.profiles.high;
      console.log('[PerformanceOptimizer] Optimal conditions, switching to high performance');
    } else {
      selectedProfile = this.profiles.balanced;
      console.log('[PerformanceOptimizer] Using balanced profile');
    }

    if (this.currentProfile.name !== selectedProfile.name) {
      await this.setProfile(selectedProfile);
    }

    return selectedProfile;
  }

  async setProfile(profile: PerformanceProfile | string): Promise<void> {
    if (typeof profile === 'string') {
      const profileObj = this.profiles[profile];
      if (!profileObj) {
        throw new Error(`Unknown profile: ${profile}`);
      }
      this.currentProfile = profileObj;
    } else {
      this.currentProfile = profile;
    }

    console.log('[PerformanceOptimizer] Profile changed to:', this.currentProfile.name);

    if (!this.currentProfile.enableCaching) {
      this.clearCache();
    }

    await this.saveProfile();
  }

  getProfile(): PerformanceProfile {
    return { ...this.currentProfile };
  }

  getAllProfiles(): PerformanceProfile[] {
    return Object.values(this.profiles);
  }

  cacheGet<T>(key: string): T | undefined {
    if (!this.currentProfile.enableCaching) {
      return undefined;
    }

    const cached = this.cache.get(key);
    if (cached) {
      console.log(`[PerformanceOptimizer] Cache hit: ${key}`);
      return cached.data as T;
    }

    return undefined;
  }

  cacheSet(key: string, data: any, ttl: number = 300000): void {
    if (!this.currentProfile.enableCaching) {
      return;
    }

    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value as string | undefined;
      if (firstKey) {
        this.cache.delete(firstKey);
        console.log('[PerformanceOptimizer] Cache eviction:', firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    console.log(`[PerformanceOptimizer] Cached: ${key}`);
  }

  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[PerformanceOptimizer] Cleared cache (${size} entries)`);
  }

  cleanExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[PerformanceOptimizer] Cleaned ${cleaned} expired cache entries`);
    }
  }

  async getOptimizationMetrics(): Promise<OptimizationMetrics> {
    const metrics = await deviceMetricsMonitor.getCurrentMetrics();
    const suggestions: string[] = [];

    if (metrics.memoryUsagePercent > 80) {
      suggestions.push('Consider reducing batch size or clearing cache');
    }

    if (metrics.thermalState >= ThermalState.Serious) {
      suggestions.push('Device is hot - reduce processing load');
    }

    if (metrics.batteryLevel < 0.2 && !metrics.isLowPowerMode) {
      suggestions.push('Low battery - enable power saver mode');
    }

    if (this.cache.size > this.MAX_CACHE_SIZE * 0.9) {
      suggestions.push('Cache nearly full - consider clearing old entries');
    }

    return {
      currentProfile: this.getProfile(),
      memoryUsage: metrics.memoryUsagePercent,
      thermalState: metrics.thermalState,
      batteryLevel: metrics.batteryLevel,
      optimizationsSuggested: suggestions,
    };
  }

  private async loadSavedProfile(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const profileName = JSON.parse(saved) as string;
        if (profileName && this.profiles[profileName]) {
          this.currentProfile = this.profiles[profileName];
          console.log('[PerformanceOptimizer] Loaded saved profile:', profileName);
        }
      }
    } catch (error) {
      console.error('[PerformanceOptimizer] Failed to load saved profile:', error);
    }
  }

  private async saveProfile(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(this.currentProfile.name)
      );
    } catch (error) {
      console.error('[PerformanceOptimizer] Failed to save profile:', error);
    }
  }

  shouldThrottle(): boolean {
    return (
      this.currentProfile.name === 'thermal_throttled' ||
      this.currentProfile.name === 'power_saver'
    );
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      utilizationPercent: (this.cache.size / this.MAX_CACHE_SIZE) * 100,
      enabled: this.currentProfile.enableCaching,
    };
  }
}

export const performanceOptimizer = PerformanceOptimizer.getInstance();
export default performanceOptimizer;
