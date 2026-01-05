import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SommeilParadoxal, OptimizationTask, SommeilMetrics } from '@/lib/utils/sommeil-paradoxal';
import { useTelemetry } from './telemetry';

const CHECK_INTERVAL = 15000;

export const [SommeilProvider, useSommeil] = createContextHook(() => {
  const telemetry = useTelemetry();
  const sommeilRef = useRef(new SommeilParadoxal());
  const [metrics, setMetrics] = useState<SommeilMetrics>(sommeilRef.current.getMetrics());
  const [queuedTasks, setQueuedTasks] = useState<OptimizationTask[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAndRun = useCallback(async () => {
    const isIdle = () => {
      const cpuIdle = Math.random() > 0.7;
      return cpuIdle;
    };

    await sommeilRef.current.runCycle(
      isIdle,
      async (count) => {
        telemetry.emit('system', 'sommeil_consolidate', { count }, 'info');
        console.log(`[Sommeil] Consolidated ${count} memories`);
      },
      async () => {
        telemetry.emit('system', 'sommeil_index_rebuild', {}, 'info');
        console.log('[Sommeil] Rebuilt indices');
      }
    );

    setMetrics(sommeilRef.current.getMetrics());
    setQueuedTasks(sommeilRef.current.getQueuedTasks());
  }, [telemetry]);

  const scheduleMaintenanceTasks = useCallback(() => {
    sommeilRef.current.scheduleMaintenanceTasks();
    setQueuedTasks(sommeilRef.current.getQueuedTasks());
    telemetry.emit('system', 'sommeil_maintenance_scheduled', {}, 'info');
  }, [telemetry]);

  const queueOptimization = useCallback((type: OptimizationTask['type'], priority: number = 1) => {
    sommeilRef.current.queueOptimization(type, priority);
    setQueuedTasks(sommeilRef.current.getQueuedTasks());
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(checkAndRun, CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkAndRun]);

  return {
    metrics,
    queuedTasks,
    scheduleMaintenanceTasks,
    queueOptimization,
    runCycleNow: checkAndRun,
  };
});
