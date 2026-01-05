import { useState, useEffect, useCallback } from 'react';
import { deviceMetricsMonitor, DeviceMetrics } from '@/lib/utils/device-metrics';
import { performanceOptimizer, PerformanceProfile, OptimizationMetrics } from '@/lib/utils/performance-optimizer';

export interface UsePerformanceMonitoringOptions {
  enableAutoOptimization?: boolean;
  monitoringInterval?: number;
  onProfileChange?: (profile: PerformanceProfile) => void;
}

export function usePerformanceMonitoring(options: UsePerformanceMonitoringOptions = {}) {
  const {
    enableAutoOptimization = true,
    monitoringInterval = 5000,
    onProfileChange,
  } = options;

  const [currentMetrics, setCurrentMetrics] = useState<DeviceMetrics | null>(null);
  const [currentProfile, setCurrentProfile] = useState<PerformanceProfile>(
    performanceOptimizer.getProfile()
  );
  const [optimizationMetrics, setOptimizationMetrics] = useState<OptimizationMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const startMonitoring = useCallback(async () => {
    if (isMonitoring) return;

    console.log('[usePerformanceMonitoring] Starting monitoring');
    await deviceMetricsMonitor.startMonitoring(monitoringInterval);
    setIsMonitoring(true);
  }, [isMonitoring, monitoringInterval]);

  const stopMonitoring = useCallback(() => {
    console.log('[usePerformanceMonitoring] Stopping monitoring');
    deviceMetricsMonitor.stopMonitoring();
    setIsMonitoring(false);
  }, []);

  const refreshMetrics = useCallback(async () => {
    const metrics = await deviceMetricsMonitor.getCurrentMetrics();
    setCurrentMetrics(metrics);

    const optMetrics = await performanceOptimizer.getOptimizationMetrics();
    setOptimizationMetrics(optMetrics);

    return { deviceMetrics: metrics, optimizationMetrics: optMetrics };
  }, []);

  const optimizePerformance = useCallback(async () => {
    const newProfile = await performanceOptimizer.autoOptimize();
    setCurrentProfile(newProfile);
    onProfileChange?.(newProfile);
    return newProfile;
  }, [onProfileChange]);

  const setProfile = useCallback(
    async (profile: PerformanceProfile | string) => {
      await performanceOptimizer.setProfile(profile);
      const newProfile = performanceOptimizer.getProfile();
      setCurrentProfile(newProfile);
      onProfileChange?.(newProfile);
    },
    [onProfileChange]
  );

  const clearCache = useCallback(() => {
    performanceOptimizer.clearCache();
  }, []);

  const getCacheStats = useCallback(() => {
    return performanceOptimizer.getCacheStats();
  }, []);

  useEffect(() => {
    if (enableAutoOptimization) {
      const interval = setInterval(async () => {
        await refreshMetrics();
        await optimizePerformance();
      }, monitoringInterval);

      return () => clearInterval(interval);
    }
  }, [enableAutoOptimization, monitoringInterval, refreshMetrics, optimizePerformance]);

  useEffect(() => {
    startMonitoring();
    refreshMetrics();

    return () => {
      stopMonitoring();
    };
  }, [startMonitoring, refreshMetrics, stopMonitoring]);

  return {
    currentMetrics,
    currentProfile,
    optimizationMetrics,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    refreshMetrics,
    optimizePerformance,
    setProfile,
    clearCache,
    getCacheStats,
  };
}
