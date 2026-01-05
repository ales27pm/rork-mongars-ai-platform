import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EvolutionCycle, SystemMetrics } from '@/types';
import { ManifestManager } from '@/lib/utils/model-manifest';
import { useInstrumentation } from './instrumentation';

interface TrainingDataset {
  id: string;
  query: string;
  response: string;
  confidence: number;
  timestamp: number;
  sanitized: boolean;
}

interface ResourceMonitor {
  cpuUsage: number;
  memoryUsage: number;
  vramUsage: number;
  timestamp: number;
}

const STORAGE_KEY = 'mongars_evolution';
const DATASET_KEY = 'mongars_training_dataset';
const CYCLE_INTERVAL_MS = 60000;
const CARBON_THRESHOLD = 0.7;
const ENERGY_BUDGET = 100;
const MIN_CONFIDENCE_THRESHOLD = 0.85;
const MAX_DATASET_SIZE = 1000;

export const [EvolutionProvider, useEvolution] = createContextHook(() => {
  const instrumentation = useInstrumentation();
  const [cycles, setCycles] = useState<EvolutionCycle[]>([]);
  const [trainingDataset, setTrainingDataset] = useState<TrainingDataset[]>([]);
  const [resourceHistory, setResourceHistory] = useState<ResourceMonitor[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    memoryUsage: { shortTerm: 0, longTerm: 0, maxCapacity: 1000 },
    inferenceStats: {
      totalRequests: 0,
      avgLatency: 0,
      cacheHitRate: 0,
      fallbackCount: 0,
    },
    evolutionStats: {
      cyclesCompleted: 0,
      lastCycleTimestamp: undefined,
      nextScheduled: undefined,
    },
  });
  const [isRunning, setIsRunning] = useState(false);
  const cycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manifestManager = useRef(new ManifestManager());

  const loadCycles = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCycles(JSON.parse(stored));
      }
      
      const datasetStored = await AsyncStorage.getItem(DATASET_KEY);
      if (datasetStored) {
        setTrainingDataset(JSON.parse(datasetStored));
      }
    } catch (error) {
      console.error('[Evolution] Load error:', error);
    }
  }, []);

  const saveCycles = useCallback(async (newCycles: EvolutionCycle[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newCycles));
    } catch (error) {
      console.error('[Evolution] Save error:', error);
    }
  }, []);

  const saveDataset = useCallback(async (dataset: TrainingDataset[]) => {
    try {
      await AsyncStorage.setItem(DATASET_KEY, JSON.stringify(dataset));
    } catch (error) {
      console.error('[Evolution] Dataset save error:', error);
    }
  }, []);

  const sanitizePII = useCallback((text: string): string => {
    let sanitized = text;
    
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
    sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
    sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
    sanitized = sanitized.replace(/\b(?:\d{4}[- ]?){3}\d{4}\b/g, '[CREDIT_CARD]');
    sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_ADDRESS]');
    
    return sanitized;
  }, []);

  const recordHighQualityInteraction = useCallback((query: string, response: string, confidence: number) => {
    const endOp = instrumentation.startOperation('evolution', 'record-interaction', { confidence });
    
    if (confidence < MIN_CONFIDENCE_THRESHOLD) {
      console.log(`[Evolution] Interaction below threshold (${confidence.toFixed(2)} < ${MIN_CONFIDENCE_THRESHOLD})`);
      endOp();
      return;
    }

    const sanitizedQuery = sanitizePII(query);
    const sanitizedResponse = sanitizePII(response);

    const entry: TrainingDataset = {
      id: `train_${Date.now()}`,
      query: sanitizedQuery,
      response: sanitizedResponse,
      confidence,
      timestamp: Date.now(),
      sanitized: true,
    };

    setTrainingDataset(prev => {
      const updated = [...prev, entry];
      if (updated.length > MAX_DATASET_SIZE) {
        const sorted = updated.sort((a, b) => b.confidence - a.confidence);
        const trimmed = sorted.slice(0, MAX_DATASET_SIZE);
        saveDataset(trimmed);
        return trimmed;
      }
      saveDataset(updated);
      return updated;
    });

    console.log(`[Evolution] High-quality interaction recorded (confidence: ${confidence.toFixed(2)}, dataset size: ${trainingDataset.length + 1})`);
    endOp();
  }, [sanitizePII, saveDataset, trainingDataset.length, instrumentation]);

  const monitorResources = useCallback(() => {
    const snapshot: ResourceMonitor = {
      cpuUsage: Math.random() * 100,
      memoryUsage: (metrics.memoryUsage.shortTerm / metrics.memoryUsage.maxCapacity) * 100,
      vramUsage: Math.random() * 24,
      timestamp: Date.now(),
    };

    setResourceHistory(prev => {
      const updated = [...prev, snapshot];
      return updated.slice(-100);
    });

    return snapshot;
  }, [metrics]);

  const checkSystemIdle = useCallback((): boolean => {
    const resources = monitorResources();
    
    const avgCpu = resourceHistory.length > 0
      ? resourceHistory.reduce((sum, r) => sum + r.cpuUsage, 0) / resourceHistory.length
      : resources.cpuUsage;
    
    const avgVram = resourceHistory.length > 0
      ? resourceHistory.reduce((sum, r) => sum + r.vramUsage, 0) / resourceHistory.length
      : resources.vramUsage;

    const isIdle = resources.cpuUsage < 30 && resources.memoryUsage < 80 && avgVram < 18;
    
    console.log(`[Evolution] Resource check - CPU: ${resources.cpuUsage.toFixed(1)}% (avg: ${avgCpu.toFixed(1)}%), Memory: ${resources.memoryUsage.toFixed(1)}%, VRAM: ${avgVram.toFixed(1)}GB, Idle: ${isIdle}`);
    
    return isIdle;
  }, [monitorResources, resourceHistory]);

  const checkCarbonPolicy = useCallback((): { allowed: boolean; reason?: string } => {
    const carbonIntensity = Math.random();
    const energyUsed = Math.random() * ENERGY_BUDGET;

    if (carbonIntensity > CARBON_THRESHOLD) {
      return { allowed: false, reason: 'Carbon intensity too high' };
    }

    if (energyUsed > ENERGY_BUDGET * 0.9) {
      return { allowed: false, reason: 'Energy budget exceeded' };
    }

    return { allowed: true };
  }, []);

  const runEvolutionCycle = useCallback(async () => {
    const endOp = instrumentation.startOperation('evolution', 'run-cycle');
    console.log('[Evolution] Attempting cycle...');
    
    if (trainingDataset.length < 10) {
      console.log(`[Evolution] Insufficient training data (${trainingDataset.length} < 10), deferring...`);
      return;
    }
    
    const idle = checkSystemIdle();
    if (!idle) {
      console.log('[Evolution] System busy, deferring...');
      const deferred: EvolutionCycle = {
        id: `cycle_${Date.now()}`,
        timestamp: Date.now(),
        status: 'deferred',
        reason: 'System not idle',
      };
      setCycles(prev => {
        const updated = [...prev, deferred];
        saveCycles(updated);
        return updated;
      });
      return;
    }

    const carbonCheck = checkCarbonPolicy();
    if (!carbonCheck.allowed) {
      console.log('[Evolution] Carbon policy failed:', carbonCheck.reason);
      const deferred: EvolutionCycle = {
        id: `cycle_${Date.now()}`,
        timestamp: Date.now(),
        status: 'deferred',
        reason: carbonCheck.reason,
      };
      setCycles(prev => {
        const updated = [...prev, deferred];
        saveCycles(updated);
        return updated;
      });
      return;
    }

    const startTime = Date.now();
    const avgConfidence = trainingDataset.reduce((sum, d) => sum + d.confidence, 0) / trainingDataset.length;
    
    const cycle: EvolutionCycle = {
      id: `cycle_${startTime}`,
      timestamp: startTime,
      status: 'running',
      metrics: {
        samplesCollected: trainingDataset.length,
        confidenceAvg: avgConfidence,
        carbonIntensity: Math.random(),
        energyBudget: ENERGY_BUDGET,
      },
    };

    setCycles(prev => [...prev, cycle]);
    setIsRunning(true);

    console.log(`[Evolution] Training cycle started with ${trainingDataset.length} samples (avg confidence: ${avgConfidence.toFixed(2)})`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    const success = Math.random() > 0.2;
    
    const completed: EvolutionCycle = {
      ...cycle,
      status: success ? 'completed' : 'failed',
      duration: Date.now() - startTime,
      reason: success ? undefined : 'Simulated training failure',
    };

    setCycles(prev => {
      const updated = prev.map(c => c.id === cycle.id ? completed : c);
      saveCycles(updated);
      return updated;
    });

    if (success) {
      const checksum = Math.random().toString(36).slice(2, 10);
      manifestManager.current.registerAdapter({
        version: `v${Date.now()}`,
        baseModel: 'unified-llm',
        adapterType: 'lora',
        trainingTimestamp: Date.now(),
        metrics: {
          loss: 0.5 + Math.random() * 0.3,
          perplexity: 10 + Math.random() * 5,
          samples: trainingDataset.length,
        },
        checksum,
        path: `/adapters/lora_${Date.now()}.bin`,
      });

      const adapters = manifestManager.current.listAdapters();
      if (adapters.length > 0) {
        manifestManager.current.setActiveAdapter(adapters[0].id);
      }

      setMetrics(prev => ({
        ...prev,
        evolutionStats: {
          ...prev.evolutionStats,
          cyclesCompleted: prev.evolutionStats.cyclesCompleted + 1,
          lastCycleTimestamp: Date.now(),
          nextScheduled: Date.now() + CYCLE_INTERVAL_MS,
        },
      }));
      console.log('[Evolution] Cycle completed successfully - new adapter registered and activated');
    } else {
      console.log('[Evolution] Cycle failed - retaining previous weights');
    }

    setIsRunning(false);
    endOp();
  }, [trainingDataset, checkSystemIdle, checkCarbonPolicy, saveCycles, instrumentation]);

  const scheduleNextCycle = useCallback(() => {
    if (cycleTimeoutRef.current) {
      clearTimeout(cycleTimeoutRef.current);
    }

    cycleTimeoutRef.current = setTimeout(() => {
      runEvolutionCycle();
    }, CYCLE_INTERVAL_MS);
  }, [runEvolutionCycle]);

  const updateMetrics = useCallback((updates: Partial<SystemMetrics>) => {
    setMetrics(prev => ({ ...prev, ...updates }));
  }, []);

  const triggerManualCycle = useCallback(() => {
    if (!isRunning) {
      runEvolutionCycle();
    }
  }, [isRunning, runEvolutionCycle]);

  useEffect(() => {
    loadCycles();
    scheduleNextCycle();

    return () => {
      if (cycleTimeoutRef.current) {
        clearTimeout(cycleTimeoutRef.current);
      }
    };
  }, [loadCycles, scheduleNextCycle]);

  const getManifestStats = useCallback(() => {
    return manifestManager.current.getStats();
  }, []);

  return {
    cycles,
    metrics,
    isRunning,
    trainingDataset,
    resourceHistory,
    runEvolutionCycle,
    triggerManualCycle,
    updateMetrics,
    recordHighQualityInteraction,
    monitorResources,
    getManifestStats,
  };
});
