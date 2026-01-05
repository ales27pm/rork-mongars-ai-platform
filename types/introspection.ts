export interface InstrumentationMetric {
  subsystem: string;
  operation: string;
  timestamp: number;
  durationMs?: number;
  confidence?: number;
  status: 'started' | 'completed' | 'failed' | 'cached';
  metadata: Record<string, any>;
}

export interface SubsystemState {
  name: string;
  status: 'idle' | 'active' | 'overloaded' | 'error';
  lastActivity: number;
  metrics: {
    operationCount: number;
    averageDurationMs: number;
    errorRate: number;
    cacheHitRate: number;
  };
  resources: {
    memoryUsageMb?: number;
    activeThreads?: number;
    queueDepth?: number;
  };
}

export interface CognitiveState {
  activeGoals: string[];
  modulesEngaged: string[];
  attentionFocus: string[];
  confidenceLevel: number;
  temperature: number;
  reasoningDepth: number;
  memoryContext: {
    shortTermCount: number;
    longTermAccessed: number;
    vectorSearches: number;
  };
}

export interface IntrospectionSnapshot {
  timestamp: number;
  sessionId: string;
  subsystems: SubsystemState[];
  cognitiveState: CognitiveState;
  systemHealth: {
    overallStatus: 'healthy' | 'degraded' | 'critical';
    alerts: string[];
    uptime: number;
  };
  recentEvents: InstrumentationMetric[];
}

export interface SelfModelSchema {
  architecture: {
    version: string;
    subsystems: {
      id: string;
      name: string;
      dependencies: string[];
      capabilities: string[];
    }[];
  };
  configuration: {
    privacyMode: boolean;
    introspectionEnabled: boolean;
    maxHistorySize: number;
    samplingRate: number;
  };
  capabilities: string[];
}

export interface ReflectionResult {
  query: string;
  timestamp: number;
  summary: string;
  insights: {
    category: 'performance' | 'health' | 'behavior' | 'resources';
    observation: string;
    confidence: number;
  }[];
  recommendations: string[];
  rawMetrics?: IntrospectionSnapshot;
}

export type IntrospectionGranularity = 'minimal' | 'standard' | 'detailed' | 'debug';

export interface InstrumentationConfig {
  enabled: boolean;
  granularity: IntrospectionGranularity;
  bufferSize: number;
  flushIntervalMs: number;
  excludePatterns: string[];
  privacyFilters: {
    maskUserContent: boolean;
    maskModelWeights: boolean;
    maskSecrets: boolean;
  };
}
