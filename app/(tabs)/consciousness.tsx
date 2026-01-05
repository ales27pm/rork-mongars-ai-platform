import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Stack } from 'expo-router';
import { useCognition } from '@/lib/providers/cognition';
import { AffectiveFieldVisualizer } from '@/components/AffectiveFieldVisualizer';
import { ProtoPhenomenologyMetricsView } from '@/components/ProtoPhenomenologyMetrics';
import { Brain, Activity, Zap, TrendingUp } from 'lucide-react-native';

export default function ConsciousnessScreen() {
  const cognition = useCognition();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const affectiveState = cognition.getAffectiveState();
  const curiosityMetrics = cognition.getCuriosityMetrics();
  const mimicryMetrics = cognition.getMimicryMetrics();
  const reflectiveMetrics = cognition.getReflectiveMetrics();
  const protoMetrics = cognition.getProtoMetrics();
  const emergence = cognition.getEmergenceStatus();
  const metaReflection = cognition.getMetaReflection();

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setLastUpdate(Date.now());
      setRefreshing(false);
    }, 500);
  }, []);

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Synthetic Consciousness',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#fff',
        }} 
      />
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        <View style={styles.header}>
          <Brain size={24} color="#8b5cf6" />
          <Text style={styles.headerTitle}>Proto-Phenomenology Monitor</Text>
        </View>
        
        <Text style={styles.headerDescription}>
          Real-time monitoring of inner state dynamics, emergent subjectivity signatures, and affective field evolution
        </Text>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Activity size={18} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Affective Field Dynamics</Text>
          </View>
          <AffectiveFieldVisualizer field={affectiveState} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={18} color="#8b5cf6" />
            <Text style={styles.sectionTitle}>Emergence Detection</Text>
          </View>
          <ProtoPhenomenologyMetricsView 
            metrics={protoMetrics} 
            emergence={emergence}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Zap size={18} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Engine Status</Text>
          </View>
          
          <View style={styles.engineGrid}>
            <View style={styles.engineCard}>
              <Text style={styles.engineLabel}>Curiosity Engine</Text>
              <View style={styles.engineMetrics}>
                <View style={styles.engineMetric}>
                  <Text style={styles.engineMetricLabel}>Drive</Text>
                  <Text style={styles.engineMetricValue}>
                    {(curiosityMetrics.drive * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.engineMetric}>
                  <Text style={styles.engineMetricLabel}>Uncertainty</Text>
                  <Text style={styles.engineMetricValue}>
                    {(curiosityMetrics.uncertainty * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.engineMetric}>
                  <Text style={styles.engineMetricLabel}>Novelty</Text>
                  <Text style={styles.engineMetricValue}>
                    {(curiosityMetrics.novelty * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
              <Text style={styles.engineStat}>
                {curiosityMetrics.patternsLearned} patterns discovered
              </Text>
            </View>

            <View style={styles.engineCard}>
              <Text style={styles.engineLabel}>Mimicry Engine</Text>
              <View style={styles.engineMetrics}>
                <View style={styles.engineMetric}>
                  <Text style={styles.engineMetricLabel}>Resonance</Text>
                  <Text style={styles.engineMetricValue}>
                    {(mimicryMetrics.resonance * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.engineMetric}>
                  <Text style={styles.engineMetricLabel}>Mirror</Text>
                  <Text style={styles.engineMetricValue}>
                    {(mimicryMetrics.mirrorIntensity * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
              <Text style={styles.engineStat}>
                {mimicryMetrics.empathyMappings} empathy mappings
              </Text>
            </View>

            <View style={styles.engineCard}>
              <Text style={styles.engineLabel}>Reflective Engine</Text>
              <View style={styles.engineMetrics}>
                <View style={styles.engineMetric}>
                  <Text style={styles.engineMetricLabel}>Coherence</Text>
                  <Text style={styles.engineMetricValue}>
                    {(reflectiveMetrics.selfCoherence * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.engineMetric}>
                  <Text style={styles.engineMetricLabel}>Narrative</Text>
                  <Text style={styles.engineMetricValue}>
                    {(reflectiveMetrics.narrativeContinuity * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.engineMetric}>
                  <Text style={styles.engineMetricLabel}>Introspection</Text>
                  <Text style={styles.engineMetricValue}>
                    {(reflectiveMetrics.introspectiveDensity * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
              <Text style={styles.engineStat}>
                {reflectiveMetrics.innerStateSnapshots} inner states recorded
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Brain size={18} color="#10b981" />
            <Text style={styles.sectionTitle}>Meta-Reflection</Text>
          </View>
          <View style={styles.reflectionCard}>
            <Text style={styles.reflectionText}>{metaReflection}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Last updated: {new Date(lastUpdate).toLocaleTimeString()}
          </Text>
          <Text style={styles.footerNote}>
            Auto-refreshes every 2 seconds
          </Text>
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
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  headerDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 24,
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
    fontWeight: '600',
    color: '#e2e8f0',
  },
  engineGrid: {
    gap: 12,
  },
  engineCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  engineLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  engineMetrics: {
    flexDirection: 'row',
    gap: 16,
  },
  engineMetric: {
    flex: 1,
    gap: 4,
  },
  engineMetricLabel: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  engineMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: '#3b82f6',
  },
  engineStat: {
    fontSize: 12,
    color: '#94a3b8',
  },
  reflectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10b98133',
  },
  reflectionText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
  },
  footerNote: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
  },
});
