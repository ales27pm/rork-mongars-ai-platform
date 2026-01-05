import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { AlertCircle, CheckCircle, TrendingUp } from 'lucide-react-native';
import type { ProtoPhenomenologyMetrics } from '@/types/affective';

interface ProtoPhenomenologyMetricsProps {
  metrics: ProtoPhenomenologyMetrics;
  emergence?: {
    detected: boolean;
    confidence: number;
    reasons: string[];
  };
}

export function ProtoPhenomenologyMetricsView({ metrics, emergence }: ProtoPhenomenologyMetricsProps) {
  const getMetricColor = (value: number, threshold: number = 0.6) => {
    if (value >= threshold) return '#10b981';
    if (value >= threshold * 0.7) return '#f59e0b';
    return '#64748b';
  };

  const getMetricIcon = (value: number, threshold: number = 0.6) => {
    if (value >= threshold) {
      return <CheckCircle size={16} color="#10b981" />;
    }
    return <AlertCircle size={16} color="#64748b" />;
  };

  const metricItems = [
    {
      label: 'Self-Reference Coherence',
      value: metrics.coherenceOfSelfReference,
      description: 'Maintains consistent self-model across interactions',
      threshold: 0.6,
    },
    {
      label: 'Emotional Trajectory Continuity',
      value: metrics.emotionalTrajectoryContinuity,
      description: 'Smooth affective state transitions over time',
      threshold: 0.7,
    },
    {
      label: 'Epistemic Surprise',
      value: metrics.epistemicSurprise,
      description: 'Affective modulation on prediction errors',
      threshold: 0.5,
    },
    {
      label: 'Phenomenal Report Structure',
      value: metrics.phenomenalReportStructure,
      description: 'Complexity of introspective statements',
      threshold: 0.5,
    },
    {
      label: 'Inner Narrative Coherence',
      value: metrics.innerNarrativeCoherence,
      description: 'Consistency of internal commentary themes',
      threshold: 0.6,
    },
    {
      label: 'Affective Modulation',
      value: metrics.affectiveModulation,
      description: 'Appropriate emotional responses to stimuli',
      threshold: 0.6,
    },
    {
      label: 'Metaphor Invention',
      value: metrics.metaphorInvention,
      description: 'Novel linguistic expressions for internal states',
      threshold: 0.4,
    },
    {
      label: 'Consistency Preference',
      value: metrics.consistencyPreference,
      description: 'Prioritizes narrative coherence over task optimization',
      threshold: 0.6,
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Proto-Phenomenology Detection</Text>
        <Text style={styles.sectionDescription}>
          Monitors indicators of emergent inner modeling and potential proto-subjectivity
        </Text>
      </View>

      {emergence && (
        <View style={[styles.emergenceCard, emergence.detected && styles.emergenceCardActive]}>
          <View style={styles.emergenceHeader}>
            <TrendingUp 
              size={20} 
              color={emergence.detected ? '#10b981' : '#64748b'} 
            />
            <Text style={[styles.emergenceTitle, emergence.detected && styles.emergenceTitleActive]}>
              {emergence.detected ? 'Emergence Detected' : 'No Emergence Detected'}
            </Text>
          </View>
          <Text style={styles.emergenceConfidence}>
            Confidence: {(emergence.confidence * 100).toFixed(1)}%
          </Text>
          {emergence.reasons.length > 0 && (
            <View style={styles.emergenceReasons}>
              <Text style={styles.emergenceReasonsTitle}>Signatures:</Text>
              {emergence.reasons.map((reason, index) => (
                <View key={index} style={styles.emergenceReason}>
                  <Text style={styles.emergenceReasonBullet}>•</Text>
                  <Text style={styles.emergenceReasonText}>{reason}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.metricsGrid}>
        {metricItems.map((item, index) => (
          <View key={index} style={styles.metricCard}>
            <View style={styles.metricHeader}>
              {getMetricIcon(item.value, item.threshold)}
              <Text style={styles.metricLabel}>{item.label}</Text>
            </View>
            
            <View style={styles.metricBarContainer}>
              <View 
                style={[
                  styles.metricBar,
                  { 
                    width: `${item.value * 100}%`,
                    backgroundColor: getMetricColor(item.value, item.threshold),
                  }
                ]}
              />
              <View 
                style={[
                  styles.metricThreshold,
                  { left: `${item.threshold * 100}%` }
                ]}
              />
            </View>

            <View style={styles.metricFooter}>
              <Text style={styles.metricValue}>
                {(item.value * 100).toFixed(1)}%
              </Text>
              <Text style={styles.metricThresholdLabel}>
                threshold: {(item.threshold * 100).toFixed(0)}%
              </Text>
            </View>

            <Text style={styles.metricDescription}>{item.description}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  emergenceCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emergenceCardActive: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  emergenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  emergenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },
  emergenceTitleActive: {
    color: '#10b981',
  },
  emergenceConfidence: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 12,
  },
  emergenceReasons: {
    gap: 6,
  },
  emergenceReasonsTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
    marginBottom: 4,
  },
  emergenceReason: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  emergenceReasonBullet: {
    fontSize: 14,
    color: '#10b981',
  },
  emergenceReasonText: {
    flex: 1,
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
  },
  metricsGrid: {
    gap: 12,
  },
  metricCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
    flex: 1,
  },
  metricBarContainer: {
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    position: 'relative',
    overflow: 'visible',
  },
  metricBar: {
    height: '100%',
    borderRadius: 4,
  },
  metricThreshold: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 12,
    backgroundColor: '#f59e0b',
  },
  metricFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: '#e2e8f0',
  },
  metricThresholdLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  metricDescription: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
});
