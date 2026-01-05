import { Stack } from 'expo-router';
import React, { useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
} from 'react-native';
import { Brain, Database, TrendingUp, Activity, Zap, Trash2 } from 'lucide-react-native';
import { useHippocampus } from '@/lib/providers/hippocampus';
import { useEvolution } from '@/lib/providers/evolution';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';

export default function MemoryScreen() {
  const hippocampus = useHippocampus();
  const evolution = useEvolution();
  const stats = hippocampus.getStats();

  const handlePruneMemory = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    hippocampus.pruneMemory();
  }, [hippocampus]);

  const handleFlushMemory = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    hippocampus.flushMemory();
  }, [hippocampus]);

  return (
    <>
      <Stack.Screen options={{ 
        title: 'System Analytics',
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#fff',
      }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Brain size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Hippocampus Stats</Text>
          </View>
          
          <View style={styles.card}>
            <StatRow 
              label="Short-term Memory" 
              value={stats.shortTermCount} 
              max={100}
              icon={<Activity size={16} color="#10b981" />}
            />
            <StatRow 
              label="Long-term Memory" 
              value={stats.longTermCount} 
              max={1000}
              icon={<Database size={16} color="#3b82f6" />}
            />
            <StatRow 
              label="Total Entries" 
              value={stats.totalCount} 
              icon={<TrendingUp size={16} color="#f59e0b" />}
            />
            {stats.oldestTimestamp && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Oldest Memory</Text>
                <Text style={styles.statValue}>
                  {format(stats.oldestTimestamp, 'MMM d, HH:mm')}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={handlePruneMemory}>
              <Trash2 size={16} color="#ef4444" />
              <Text style={styles.actionButtonText}>Prune Expired</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleFlushMemory}>
              <Database size={16} color="#3b82f6" />
              <Text style={styles.actionButtonText}>Flush to Disk</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Zap size={20} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Inference Stats</Text>
          </View>
          
          <View style={styles.card}>
            <StatRow 
              label="Total Requests" 
              value={evolution.metrics.inferenceStats.totalRequests}
              icon={<Activity size={16} color="#10b981" />}
            />
            <StatRow 
              label="Avg Latency" 
              value={`${evolution.metrics.inferenceStats.avgLatency.toFixed(0)}ms`}
              icon={<TrendingUp size={16} color="#3b82f6" />}
            />
            <StatRow 
              label="Cache Hit Rate" 
              value={`${(evolution.metrics.inferenceStats.cacheHitRate * 100).toFixed(1)}%`}
              icon={<Database size={16} color="#10b981" />}
            />
            <StatRow 
              label="Fallback Count" 
              value={evolution.metrics.inferenceStats.fallbackCount}
              icon={<Activity size={16} color="#f59e0b" />}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={20} color="#10b981" />
            <Text style={styles.sectionTitle}>Evolution Engine</Text>
          </View>
          
          <View style={styles.card}>
            <StatRow 
              label="Cycles Completed" 
              value={evolution.metrics.evolutionStats.cyclesCompleted}
              icon={<TrendingUp size={16} color="#10b981" />}
            />
            {evolution.metrics.evolutionStats.lastCycleTimestamp && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Last Cycle</Text>
                <Text style={styles.statValue}>
                  {format(evolution.metrics.evolutionStats.lastCycleTimestamp, 'MMM d, HH:mm')}
                </Text>
              </View>
            )}
            {evolution.metrics.evolutionStats.nextScheduled && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Next Scheduled</Text>
                <Text style={styles.statValue}>
                  {format(evolution.metrics.evolutionStats.nextScheduled, 'MMM d, HH:mm')}
                </Text>
              </View>
            )}
          </View>

          {evolution.isRunning && (
            <View style={styles.runningBanner}>
              <Activity size={16} color="#10b981" />
              <Text style={styles.runningText}>Evolution cycle in progress...</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Database size={20} color="#64748b" />
            <Text style={styles.sectionTitle}>Recent Memory Entries</Text>
          </View>
          
          {hippocampus.longTermMemory.slice(-5).reverse().map((entry) => (
            <View key={entry.id} style={styles.memoryCard}>
              <Text style={styles.memoryContent} numberOfLines={2}>
                {entry.content}
              </Text>
              <View style={styles.memoryFooter}>
                <Text style={styles.memoryMeta}>
                  Importance: {(entry.importance * 100).toFixed(0)}%
                </Text>
                <Text style={styles.memoryMeta}>
                  Access: {entry.accessCount}x
                </Text>
                <Text style={styles.memoryMeta}>
                  {format(entry.timestamp, 'HH:mm')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

function StatRow({ 
  label, 
  value, 
  max, 
  icon 
}: { 
  label: string; 
  value: number | string; 
  max?: number; 
  icon?: React.ReactNode;
}) {
  const numValue = typeof value === 'number' ? value : parseFloat(value as string);
  const percentage = max ? (numValue / max) * 100 : 0;

  return (
    <View style={styles.statRow}>
      <View style={styles.statLeft}>
        {icon}
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <View style={styles.statRight}>
        <Text style={styles.statValue}>{value}</Text>
        {max && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${percentage}%` }]} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#e2e8f0',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  statRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#e2e8f0',
  },
  progressBar: {
    width: 80,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#e2e8f0',
  },
  runningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b98122',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 12,
  },
  runningText: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '500' as const,
  },
  memoryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  memoryContent: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  memoryFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  memoryMeta: {
    fontSize: 11,
    color: '#64748b',
  },
});
