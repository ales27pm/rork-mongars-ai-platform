import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface TelemetryEvent {
  id: string;
  timestamp: number;
  category: 'inference' | 'memory' | 'evolution' | 'system' | 'error';
  event: string;
  data: Record<string, unknown>;
  severity: 'debug' | 'info' | 'warn' | 'error';
}

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export const [TelemetryProvider, useTelemetry] = createContextHook(() => {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const counters = useRef<Map<string, number>>(new Map());
  const timers = useRef<Map<string, number>>(new Map());

  const emit = useCallback((
    category: TelemetryEvent['category'],
    event: string,
    data: Record<string, unknown> = {},
    severity: TelemetryEvent['severity'] = 'info'
  ) => {
    const telemetryEvent: TelemetryEvent = {
      id: `telem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      category,
      event,
      data,
      severity,
    };

    setEvents(prev => {
      const updated = [...prev, telemetryEvent];
      return updated.slice(-1000);
    });

    const logPrefix = `[${category.toUpperCase()}]`;
    const message = `${event} ${JSON.stringify(data)}`;

    switch (severity) {
      case 'error':
        console.error(logPrefix, message);
        break;
      case 'warn':
        console.warn(logPrefix, message);
        break;
      case 'debug':
        console.debug(logPrefix, message);
        break;
      default:
        console.log(logPrefix, message);
    }
  }, []);

  const incrementCounter = useCallback((name: string, delta: number = 1) => {
    const current = counters.current.get(name) || 0;
    counters.current.set(name, current + delta);
    
    emit('system', 'counter_increment', { counter: name, value: current + delta }, 'debug');
  }, [emit]);

  const recordMetric = useCallback((name: string, value: number, tags?: Record<string, string>) => {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags,
    };

    setMetrics(prev => {
      const updated = [...prev, metric];
      return updated.slice(-500);
    });

    emit('system', 'metric_recorded', { metric: name, value, tags }, 'debug');
  }, [emit]);

  const startTimer = useCallback((name: string) => {
    timers.current.set(name, Date.now());
  }, []);

  const endTimer = useCallback((name: string, tags?: Record<string, string>) => {
    const startTime = timers.current.get(name);
    if (!startTime) {
      emit('system', 'timer_not_found', { timer: name }, 'warn');
      return 0;
    }

    const duration = Date.now() - startTime;
    timers.current.delete(name);
    recordMetric(`${name}_duration_ms`, duration, tags);
    
    return duration;
  }, [emit, recordMetric]);

  const getCounter = useCallback((name: string): number => {
    return counters.current.get(name) || 0;
  }, []);

  const getMetricStats = useCallback((metricName: string) => {
    const metricValues = metrics
      .filter(m => m.name === metricName)
      .map(m => m.value);

    if (metricValues.length === 0) {
      return null;
    }

    const sum = metricValues.reduce((a, b) => a + b, 0);
    const avg = sum / metricValues.length;
    const min = Math.min(...metricValues);
    const max = Math.max(...metricValues);
    const sorted = [...metricValues].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { count: metricValues.length, avg, min, max, p50, p95, p99 };
  }, [metrics]);

  const getEventsByCategory = useCallback((category: TelemetryEvent['category']) => {
    return events.filter(e => e.category === category);
  }, [events]);

  const getRecentErrors = useCallback((limit: number = 10) => {
    return events
      .filter(e => e.severity === 'error')
      .slice(-limit)
      .reverse();
  }, [events]);

  const clearOldEvents = useCallback((maxAgeMs: number = 3600000) => {
    const cutoff = Date.now() - maxAgeMs;
    setEvents(prev => prev.filter(e => e.timestamp > cutoff));
    setMetrics(prev => prev.filter(m => m.timestamp > cutoff));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      clearOldEvents(3600000);
    }, 300000);

    return () => clearInterval(interval);
  }, [clearOldEvents]);

  return {
    events,
    metrics,
    emit,
    incrementCounter,
    recordMetric,
    startTimer,
    endTimer,
    getCounter,
    getMetricStats,
    getEventsByCategory,
    getRecentErrors,
    clearOldEvents,
  };
});
