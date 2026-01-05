import { Stack } from 'expo-router';
import React, { useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
} from 'react-native';
import { Sparkles, Settings, Clock, CheckCircle, XCircle, Loader } from 'lucide-react-native';
import { useEvolution } from '@/lib/providers/evolution';
import { usePersonality } from '@/lib/providers/personality';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';

export default function EvolutionScreen() {
  const evolution = useEvolution();
  const personality = usePersonality();

  const handleTriggerCycle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    evolution.triggerManualCycle();
  }, [evolution]);

  const handleStyleChange = useCallback((style: typeof personality.profile.style) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    personality.setStyle(style);
  }, [personality]);

  const handleVerbosityChange = useCallback((verbosity: typeof personality.profile.verbosity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    personality.setVerbosity(verbosity);
  }, [personality]);

  return (
    <>
      <Stack.Screen options={{ 
        title: 'Evolution & Settings',
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#fff',
      }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={20} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Self-Improvement Cycles</Text>
          </View>

          <TouchableOpacity 
            style={[styles.triggerButton, evolution.isRunning && styles.triggerButtonDisabled]}
            onPress={handleTriggerCycle}
            disabled={evolution.isRunning}
          >
            {evolution.isRunning ? (
              <Loader size={20} color="#fff" />
            ) : (
              <Sparkles size={20} color="#fff" />
            )}
            <Text style={styles.triggerButtonText}>
              {evolution.isRunning ? 'Running...' : 'Trigger Manual Cycle'}
            </Text>
          </TouchableOpacity>

          <View style={styles.cycleList}>
            {evolution.cycles.slice(-10).reverse().map((cycle) => (
              <View key={cycle.id} style={styles.cycleCard}>
                <View style={styles.cycleHeader}>
                  <View style={styles.cycleStatus}>
                    {cycle.status === 'completed' && <CheckCircle size={16} color="#10b981" />}
                    {cycle.status === 'failed' && <XCircle size={16} color="#ef4444" />}
                    {cycle.status === 'running' && <Loader size={16} color="#3b82f6" />}
                    {cycle.status === 'deferred' && <Clock size={16} color="#f59e0b" />}
                    <Text style={[
                      styles.cycleStatusText,
                      cycle.status === 'completed' && styles.statusCompleted,
                      cycle.status === 'failed' && styles.statusFailed,
                      cycle.status === 'running' && styles.statusRunning,
                      cycle.status === 'deferred' && styles.statusDeferred,
                    ]}>
                      {cycle.status}
                    </Text>
                  </View>
                  <Text style={styles.cycleTime}>
                    {format(cycle.timestamp, 'MMM d, HH:mm')}
                  </Text>
                </View>

                {cycle.reason && (
                  <Text style={styles.cycleReason}>{cycle.reason}</Text>
                )}

                {cycle.metrics && (
                  <View style={styles.cycleMetrics}>
                    <Text style={styles.metricText}>
                      Samples: {cycle.metrics.samplesCollected}
                    </Text>
                    <Text style={styles.metricText}>
                      Confidence: {(cycle.metrics.confidenceAvg * 100).toFixed(1)}%
                    </Text>
                    {cycle.duration && (
                      <Text style={styles.metricText}>
                        Duration: {(cycle.duration / 1000).toFixed(1)}s
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Settings size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Personality Settings</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.settingLabel}>Response Style</Text>
            <View style={styles.optionsGrid}>
              {(['technical', 'casual', 'formal', 'creative'] as const).map((style) => (
                <TouchableOpacity
                  key={style}
                  style={[
                    styles.optionButton,
                    personality.profile.style === style && styles.optionButtonActive,
                  ]}
                  onPress={() => handleStyleChange(style)}
                >
                  <Text style={[
                    styles.optionButtonText,
                    personality.profile.style === style && styles.optionButtonTextActive,
                  ]}>
                    {style}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.settingLabel}>Verbosity</Text>
            <View style={styles.optionsGrid}>
              {(['concise', 'normal', 'detailed'] as const).map((verbosity) => (
                <TouchableOpacity
                  key={verbosity}
                  style={[
                    styles.optionButton,
                    personality.profile.verbosity === verbosity && styles.optionButtonActive,
                  ]}
                  onPress={() => handleVerbosityChange(verbosity)}
                >
                  <Text style={[
                    styles.optionButtonText,
                    personality.profile.verbosity === verbosity && styles.optionButtonTextActive,
                  ]}>
                    {verbosity}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.settingLabel}>Adaptation History</Text>
            <View style={styles.historyList}>
              {personality.profile.adaptationHistory.slice(-5).reverse().map((item, index) => (
                <View key={index} style={styles.historyItem}>
                  <Text style={styles.historyText} numberOfLines={2}>
                    {item.adjustment}
                  </Text>
                  <Text style={styles.historyTime}>
                    {format(item.timestamp, 'HH:mm')}
                  </Text>
                </View>
              ))}
              {personality.profile.adaptationHistory.length === 0 && (
                <Text style={styles.emptyText}>No adaptations yet</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </>
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
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  triggerButtonDisabled: {
    backgroundColor: '#334155',
  },
  triggerButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  cycleList: {
    gap: 12,
  },
  cycleCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
  },
  cycleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cycleStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cycleStatusText: {
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
  statusCompleted: {
    color: '#10b981',
  },
  statusFailed: {
    color: '#ef4444',
  },
  statusRunning: {
    color: '#3b82f6',
  },
  statusDeferred: {
    color: '#f59e0b',
  },
  cycleTime: {
    fontSize: 12,
    color: '#64748b',
  },
  cycleReason: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  cycleMetrics: {
    flexDirection: 'row',
    gap: 16,
  },
  metricText: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#e2e8f0',
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#94a3b8',
    textTransform: 'capitalize' as const,
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  historyList: {
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  historyText: {
    flex: 1,
    fontSize: 13,
    color: '#cbd5e1',
  },
  historyTime: {
    fontSize: 11,
    color: '#64748b',
    marginLeft: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic' as const,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
