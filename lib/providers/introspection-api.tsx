import React, { createContext, useContext, useCallback } from 'react';
import type {
  IntrospectionSnapshot,
  CognitiveState,
  ReflectionResult,
} from '@/types/introspection';
import { useInstrumentation } from './instrumentation';
import { useSelfModel } from './self-model';
import { useHippocampus } from './hippocampus';

interface IntrospectionAPIContextType {
  captureSnapshot: () => IntrospectionSnapshot;
  queryCognitiveState: () => CognitiveState;
  reflect: (query: string) => Promise<ReflectionResult>;
  auditSelf: () => Promise<ReflectionResult>;
  isIntrospectionEnabled: () => boolean;
}

const IntrospectionAPIContext = createContext<IntrospectionAPIContextType | null>(null);

interface IntrospectionAPIProviderProps {
  children: React.ReactNode;
  sessionId: string;
  startTime?: number;
}

export function IntrospectionAPIProvider({ 
  children, 
  sessionId,
  startTime = Date.now() 
}: IntrospectionAPIProviderProps) {
  const instrumentation = useInstrumentation();
  const selfModel = useSelfModel();
  const hippocampus = useHippocampus();

  const isIntrospectionEnabled = useCallback(() => {
    return selfModel.getSchema().configuration.introspectionEnabled;
  }, [selfModel]);

  const queryCognitiveState = useCallback((): CognitiveState => {
    const endOp = instrumentation.startOperation('introspection', 'query-cognitive-state');

    const subsystemMap = selfModel.getSubsystemMap();
    
    const activeModules = Array.from(subsystemMap.values())
      .filter(s => s.status === 'active')
      .map(s => s.name);

    const memoryStats = hippocampus.getStats();

    const state: CognitiveState = {
      activeGoals: ['respond-to-query', 'maintain-coherence', 'preserve-privacy'],
      modulesEngaged: activeModules,
      attentionFocus: activeModules.slice(0, 3),
      confidenceLevel: 0.85,
      temperature: 0.7,
      reasoningDepth: 3,
      memoryContext: {
        shortTermCount: memoryStats.shortTermCount,
        longTermAccessed: memoryStats.longTermCount,
        vectorSearches: 0,
      },
    };

    endOp();
    return state;
  }, [instrumentation, selfModel, hippocampus]);

  const captureSnapshot = useCallback((): IntrospectionSnapshot => {
    const endOp = instrumentation.startOperation('introspection', 'capture-snapshot');

    const subsystemMap = selfModel.getSubsystemMap();
    const cognitiveState = queryCognitiveState();
    const recentEvents = instrumentation.getRecentMetrics(50);

    const subsystems = Array.from(subsystemMap.values());
    const errorRate = subsystems.reduce((sum, s) => sum + s.metrics.errorRate, 0) / subsystems.length;
    const avgDuration = subsystems.reduce((sum, s) => sum + s.metrics.averageDurationMs, 0) / subsystems.length;

    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    const alerts: string[] = [];

    if (errorRate > 0.1) {
      overallStatus = 'degraded';
      alerts.push(`High error rate detected: ${(errorRate * 100).toFixed(1)}%`);
    }

    if (errorRate > 0.3) {
      overallStatus = 'critical';
      alerts.push('Critical: System error rate exceeds 30%');
    }

    if (avgDuration > 5000) {
      if (overallStatus === 'healthy') overallStatus = 'degraded';
      alerts.push(`High latency detected: ${avgDuration.toFixed(0)}ms average`);
    }

    const idleSubsystems = subsystems.filter(s => s.status === 'idle');
    if (idleSubsystems.length > subsystems.length * 0.7) {
      alerts.push(`${idleSubsystems.length} subsystems are idle`);
    }

    const snapshot: IntrospectionSnapshot = {
      timestamp: Date.now(),
      sessionId,
      subsystems,
      cognitiveState,
      systemHealth: {
        overallStatus,
        alerts,
        uptime: Date.now() - startTime,
      },
      recentEvents,
    };

    endOp();
    return snapshot;
  }, [instrumentation, selfModel, queryCognitiveState, sessionId, startTime]);

  const generateInsights = useCallback((snapshot: IntrospectionSnapshot) => {
    const insights: ReflectionResult['insights'] = [];

    const avgLatency = snapshot.subsystems.reduce(
      (sum, s) => sum + s.metrics.averageDurationMs, 0
    ) / snapshot.subsystems.length;

    if (avgLatency < 100) {
      insights.push({
        category: 'performance',
        observation: `Excellent response time: ${avgLatency.toFixed(0)}ms average`,
        confidence: 0.95,
      });
    } else if (avgLatency > 1000) {
      insights.push({
        category: 'performance',
        observation: `Elevated latency detected: ${avgLatency.toFixed(0)}ms average. Consider optimization.`,
        confidence: 0.9,
      });
    }

    const highCacheHitRate = snapshot.subsystems.some(s => s.metrics.cacheHitRate > 0.7);
    if (highCacheHitRate) {
      insights.push({
        category: 'performance',
        observation: 'High cache hit rate indicates effective memory utilization',
        confidence: 0.88,
      });
    }

    if (snapshot.systemHealth.overallStatus === 'healthy') {
      insights.push({
        category: 'health',
        observation: 'All subsystems operating within normal parameters',
        confidence: 0.92,
      });
    } else if (snapshot.systemHealth.overallStatus === 'degraded') {
      insights.push({
        category: 'health',
        observation: 'System degradation detected. Performance may be impacted.',
        confidence: 0.85,
      });
    }

    const activeCount = snapshot.subsystems.filter(s => s.status === 'active').length;
    insights.push({
      category: 'behavior',
      observation: `${activeCount} of ${snapshot.subsystems.length} subsystems currently active`,
      confidence: 1.0,
    });

    const totalOps = snapshot.subsystems.reduce((sum, s) => sum + s.metrics.operationCount, 0);
    if (totalOps > 1000) {
      insights.push({
        category: 'behavior',
        observation: `High activity level: ${totalOps} total operations processed`,
        confidence: 0.95,
      });
    }

    return insights;
  }, []);

  const generateRecommendations = useCallback((snapshot: IntrospectionSnapshot): string[] => {
    const recommendations: string[] = [];

    const errorRate = snapshot.subsystems.reduce(
      (sum, s) => sum + s.metrics.errorRate, 0
    ) / snapshot.subsystems.length;

    if (errorRate > 0.1) {
      recommendations.push('Investigate error logs for failing subsystems');
      recommendations.push('Consider enabling circuit breakers for unstable components');
    }

    const avgLatency = snapshot.subsystems.reduce(
      (sum, s) => sum + s.metrics.averageDurationMs, 0
    ) / snapshot.subsystems.length;

    if (avgLatency > 1000) {
      recommendations.push('Review slow operations and optimize critical paths');
      recommendations.push('Consider increasing cache size or adjusting sampling rate');
    }

    const lowCacheRate = snapshot.subsystems.some(s => s.metrics.cacheHitRate < 0.2);
    if (lowCacheRate) {
      recommendations.push('Cache hit rate is low. Review caching strategy.');
    }

    if (snapshot.cognitiveState.memoryContext.shortTermCount > 100) {
      recommendations.push('Short-term memory approaching capacity. Consider flushing.');
    }

    if (recommendations.length === 0) {
      recommendations.push('System operating optimally. Continue monitoring.');
    }

    return recommendations;
  }, []);

  const reflect = useCallback(async (query: string): Promise<ReflectionResult> => {
    const endOp = instrumentation.startOperation('introspection', 'reflect', { query });

    if (!isIntrospectionEnabled()) {
      endOp();
      throw new Error('Introspection is disabled in current configuration');
    }

    const snapshot = captureSnapshot();
    const insights = generateInsights(snapshot);
    const recommendations = generateRecommendations(snapshot);

    let summary = '';
    if (query.toLowerCase().includes('performance')) {
      const avgLatency = snapshot.subsystems.reduce(
        (sum, s) => sum + s.metrics.averageDurationMs, 0
      ) / snapshot.subsystems.length;
      summary = `Current performance: ${avgLatency.toFixed(0)}ms average latency across ${snapshot.subsystems.length} subsystems. `;
      summary += `System status: ${snapshot.systemHealth.overallStatus}.`;
    } else if (query.toLowerCase().includes('health')) {
      summary = `System health: ${snapshot.systemHealth.overallStatus}. `;
      summary += `Active subsystems: ${snapshot.subsystems.filter(s => s.status === 'active').length}/${snapshot.subsystems.length}. `;
      if (snapshot.systemHealth.alerts.length > 0) {
        summary += `Alerts: ${snapshot.systemHealth.alerts.join('; ')}`;
      }
    } else if (query.toLowerCase().includes('memory')) {
      summary = `Memory context: ${snapshot.cognitiveState.memoryContext.shortTermCount} items in short-term, `;
      summary += `${snapshot.cognitiveState.memoryContext.longTermAccessed} long-term retrievals, `;
      summary += `${snapshot.cognitiveState.memoryContext.vectorSearches} vector searches performed.`;
    } else {
      summary = `System operating with ${snapshot.subsystems.length} subsystems. `;
      summary += `Overall status: ${snapshot.systemHealth.overallStatus}. `;
      summary += `${insights.length} insights generated.`;
    }

    const result: ReflectionResult = {
      query,
      timestamp: Date.now(),
      summary,
      insights,
      recommendations,
      rawMetrics: snapshot,
    };

    endOp();
    return result;
  }, [
    instrumentation,
    isIntrospectionEnabled,
    captureSnapshot,
    generateInsights,
    generateRecommendations,
  ]);

  const auditSelf = useCallback(async (): Promise<ReflectionResult> => {
    return reflect('Perform comprehensive self-audit');
  }, [reflect]);

  const value: IntrospectionAPIContextType = {
    captureSnapshot,
    queryCognitiveState,
    reflect,
    auditSelf,
    isIntrospectionEnabled,
  };

  return (
    <IntrospectionAPIContext.Provider value={value}>
      {children}
    </IntrospectionAPIContext.Provider>
  );
}

export function useIntrospectionAPI() {
  const context = useContext(IntrospectionAPIContext);
  if (!context) {
    throw new Error('useIntrospectionAPI must be used within IntrospectionAPIProvider');
  }
  return context;
}
