import React, { createContext, useContext, useCallback, useRef, useMemo } from 'react';
import type { SelfModelSchema, SubsystemState } from '@/types/introspection';
import { useInstrumentation } from './instrumentation';

interface SelfModelContextType {
  getSchema: () => SelfModelSchema;
  getSubsystemMap: () => Map<string, SubsystemState>;
  getCapabilities: () => string[];
  registerSubsystem: (
    id: string,
    name: string,
    dependencies: string[],
    capabilities: string[]
  ) => void;
  unregisterSubsystem: (id: string) => void;
}

const SelfModelContext = createContext<SelfModelContextType | null>(null);

interface SelfModelProviderProps {
  children: React.ReactNode;
  version?: string;
}

export function SelfModelProvider({ children, version = '1.0.0' }: SelfModelProviderProps) {
  const instrumentation = useInstrumentation();
  const subsystems = useRef<Map<string, {
    id: string;
    name: string;
    dependencies: string[];
    capabilities: string[];
  }>>(new Map());

  const coreSubsystems = useMemo(() => [
    {
      id: 'cognition',
      name: 'Cognition Core',
      dependencies: ['memory', 'unified-llm'],
      capabilities: ['reasoning', 'query-processing', 'context-enrichment'],
    },
    {
      id: 'memory',
      name: 'Hippocampus Memory',
      dependencies: ['persistence'],
      capabilities: ['short-term-storage', 'long-term-storage', 'vector-search'],
    },
    {
      id: 'unified-llm',
      name: 'Unified LLM Runtime',
      dependencies: [],
      capabilities: ['text-generation', 'embedding', 'reasoning'],
    },
    {
      id: 'evolution',
      name: 'Evolution Engine',
      dependencies: ['cognition', 'telemetry'],
      capabilities: ['self-training', 'adapter-management', 'optimization'],
    },
    {
      id: 'personality',
      name: 'Personality Engine',
      dependencies: ['memory'],
      capabilities: ['style-adaptation', 'tone-matching', 'mimicry'],
    },
    {
      id: 'telemetry',
      name: 'Telemetry System',
      dependencies: [],
      capabilities: ['metrics-collection', 'performance-monitoring', 'alerting'],
    },
    {
      id: 'persistence',
      name: 'Persistence Layer',
      dependencies: [],
      capabilities: ['data-storage', 'vector-indexing', 'transaction-management'],
    },
    {
      id: 'sommeil',
      name: 'Sommeil Paradoxal',
      dependencies: ['evolution', 'cognition'],
      capabilities: ['background-optimization', 'idle-detection', 'self-improvement'],
    },
  ], []);

  const registerSubsystem = useCallback((
    id: string,
    name: string,
    dependencies: string[],
    capabilities: string[]
  ) => {
    subsystems.current.set(id, { id, name, dependencies, capabilities });
    
    instrumentation.record({
      subsystem: 'self-model',
      operation: 'register-subsystem',
      status: 'completed',
      metadata: { subsystemId: id, name },
    });
  }, [instrumentation]);

  const unregisterSubsystem = useCallback((id: string) => {
    subsystems.current.delete(id);
    
    instrumentation.record({
      subsystem: 'self-model',
      operation: 'unregister-subsystem',
      status: 'completed',
      metadata: { subsystemId: id },
    });
  }, [instrumentation]);

  const getSchema = useCallback((): SelfModelSchema => {
    const allSubsystems = [
      ...coreSubsystems,
      ...Array.from(subsystems.current.values()),
    ];

    const allCapabilities = Array.from(
      new Set(allSubsystems.flatMap(s => s.capabilities))
    );

    return {
      architecture: {
        version,
        subsystems: allSubsystems,
      },
      configuration: {
        privacyMode: true,
        introspectionEnabled: true,
        maxHistorySize: 1000,
        samplingRate: 1.0,
      },
      capabilities: allCapabilities,
    };
  }, [version, coreSubsystems]);

  const getSubsystemMap = useCallback((): Map<string, SubsystemState> => {
    const map = new Map<string, SubsystemState>();
    
    const allSubsystemIds = [
      ...coreSubsystems.map(s => s.id),
      ...Array.from(subsystems.current.keys()),
    ];

    for (const id of allSubsystemIds) {
      const state = instrumentation.getSubsystemState(id);
      if (state) {
        map.set(id, state);
      } else {
        map.set(id, {
          name: id,
          status: 'idle',
          lastActivity: Date.now(),
          metrics: {
            operationCount: 0,
            averageDurationMs: 0,
            errorRate: 0,
            cacheHitRate: 0,
          },
          resources: {},
        });
      }
    }

    return map;
  }, [coreSubsystems, instrumentation]);

  const getCapabilities = useCallback((): string[] => {
    return getSchema().capabilities;
  }, [getSchema]);

  const value: SelfModelContextType = {
    getSchema,
    getSubsystemMap,
    getCapabilities,
    registerSubsystem,
    unregisterSubsystem,
  };

  return (
    <SelfModelContext.Provider value={value}>
      {children}
    </SelfModelContext.Provider>
  );
}

export function useSelfModel() {
  const context = useContext(SelfModelContext);
  if (!context) {
    throw new Error('useSelfModel must be used within SelfModelProvider');
  }
  return context;
}
