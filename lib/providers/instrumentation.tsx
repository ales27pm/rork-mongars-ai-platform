import React, { createContext, useContext, useCallback, useRef, useEffect, useMemo } from 'react';
import type {
  InstrumentationMetric,
  InstrumentationConfig,
  SubsystemState,
} from '@/types/introspection';

interface InstrumentationContextType {
  record: (metric: Omit<InstrumentationMetric, 'timestamp'>) => void;
  startOperation: (subsystem: string, operation: string, metadata?: Record<string, any>) => () => void;
  getSubsystemState: (subsystem: string) => SubsystemState | null;
  getRecentMetrics: (limit?: number) => InstrumentationMetric[];
  flush: () => void;
}

const InstrumentationContext = createContext<InstrumentationContextType | null>(null);

interface InstrumentationProviderProps {
  children: React.ReactNode;
  config?: Partial<InstrumentationConfig>;
}

export function InstrumentationProvider({ children, config }: InstrumentationProviderProps) {
  const metricsBuffer = useRef<InstrumentationMetric[]>([]);
  const subsystemStates = useRef<Map<string, SubsystemState>>(new Map());
  const operationTimers = useRef<Map<string, number>>(new Map());
  
  const fullConfig: InstrumentationConfig = useMemo(() => ({
    enabled: true,
    granularity: 'standard',
    bufferSize: 1000,
    flushIntervalMs: 5000,
    excludePatterns: [],
    privacyFilters: {
      maskUserContent: true,
      maskModelWeights: true,
      maskSecrets: true,
    },
    ...config,
  }), [config]);

  const applyPrivacyFilters = useCallback((metadata: Record<string, any>): Record<string, any> => {
    if (!fullConfig.privacyFilters.maskUserContent) return metadata;

    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (key === 'userInput' || key === 'response' || key === 'content') {
        filtered[key] = '[REDACTED]';
      } else if (key === 'weights' || key === 'parameters') {
        filtered[key] = fullConfig.privacyFilters.maskModelWeights ? '[MASKED]' : value;
      } else if (key.includes('secret') || key.includes('key') || key.includes('token')) {
        filtered[key] = '[SECRET]';
      } else if (typeof value === 'object' && value !== null) {
        filtered[key] = applyPrivacyFilters(value);
      } else {
        filtered[key] = value;
      }
    }
    return filtered;
  }, [fullConfig.privacyFilters]);

  const flush = useCallback(() => {
    if (metricsBuffer.current.length > 0) {
      const metrics = [...metricsBuffer.current];
      metricsBuffer.current = [];
      
      if (__DEV__) {
        console.log(`[Instrumentation] Flushed ${metrics.length} metrics`);
      }
    }
  }, []);

  const updateSubsystemState = useCallback((metric: InstrumentationMetric) => {
    const existing = subsystemStates.current.get(metric.subsystem);
    
    if (!existing) {
      subsystemStates.current.set(metric.subsystem, {
        name: metric.subsystem,
        status: 'active',
        lastActivity: metric.timestamp,
        metrics: {
          operationCount: 1,
          averageDurationMs: metric.durationMs || 0,
          errorRate: metric.status === 'failed' ? 1.0 : 0.0,
          cacheHitRate: metric.status === 'cached' ? 1.0 : 0.0,
        },
        resources: {},
      });
      return;
    }

    const count = existing.metrics.operationCount + 1;
    const totalDuration = existing.metrics.averageDurationMs * existing.metrics.operationCount;
    const newAvg = (totalDuration + (metric.durationMs || 0)) / count;
    
    const errorCount = existing.metrics.errorRate * existing.metrics.operationCount;
    const newErrors = errorCount + (metric.status === 'failed' ? 1 : 0);
    const newErrorRate = newErrors / count;

    const cacheCount = existing.metrics.cacheHitRate * existing.metrics.operationCount;
    const newCacheHits = cacheCount + (metric.status === 'cached' ? 1 : 0);
    const newCacheRate = newCacheHits / count;

    subsystemStates.current.set(metric.subsystem, {
      ...existing,
      status: metric.status === 'failed' ? 'error' : 'active',
      lastActivity: metric.timestamp,
      metrics: {
        operationCount: count,
        averageDurationMs: newAvg,
        errorRate: newErrorRate,
        cacheHitRate: newCacheRate,
      },
    });
  }, []);

  const record = useCallback((metric: Omit<InstrumentationMetric, 'timestamp'>) => {
    if (!fullConfig.enabled) return;

    const shouldExclude = fullConfig.excludePatterns.some(pattern => 
      metric.subsystem.includes(pattern) || metric.operation.includes(pattern)
    );
    if (shouldExclude) return;

    const fullMetric: InstrumentationMetric = {
      ...metric,
      timestamp: Date.now(),
      metadata: applyPrivacyFilters(metric.metadata),
    };

    metricsBuffer.current.push(fullMetric);
    updateSubsystemState(fullMetric);

    if (metricsBuffer.current.length >= fullConfig.bufferSize) {
      flush();
    }

    if (__DEV__ && fullConfig.granularity === 'debug') {
      console.log('[Instrumentation]', fullMetric);
    }
  }, [fullConfig, applyPrivacyFilters, updateSubsystemState, flush]);

  const startOperation = useCallback((
    subsystem: string,
    operation: string,
    metadata: Record<string, any> = {}
  ): (() => void) => {
    const id = `${subsystem}:${operation}:${Date.now()}`;
    operationTimers.current.set(id, Date.now());

    record({
      subsystem,
      operation,
      status: 'started',
      metadata,
    });

    return () => {
      const startTime = operationTimers.current.get(id);
      if (startTime) {
        const duration = Date.now() - startTime;
        operationTimers.current.delete(id);
        
        record({
          subsystem,
          operation,
          status: 'completed',
          durationMs: duration,
          metadata,
        });
      }
    };
  }, [record]);

  const getSubsystemState = useCallback((subsystem: string): SubsystemState | null => {
    return subsystemStates.current.get(subsystem) || null;
  }, []);

  const getRecentMetrics = useCallback((limit: number = 100): InstrumentationMetric[] => {
    return metricsBuffer.current.slice(-limit);
  }, []);

  useEffect(() => {
    const interval = setInterval(flush, fullConfig.flushIntervalMs);
    return () => clearInterval(interval);
  }, [flush, fullConfig.flushIntervalMs]);

  const value: InstrumentationContextType = {
    record,
    startOperation,
    getSubsystemState,
    getRecentMetrics,
    flush,
  };

  return (
    <InstrumentationContext.Provider value={value}>
      {children}
    </InstrumentationContext.Provider>
  );
}

export function useInstrumentation() {
  const context = useContext(InstrumentationContext);
  if (!context) {
    throw new Error('useInstrumentation must be used within InstrumentationProvider');
  }
  return context;
}
