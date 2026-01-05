import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useIntrospectionAPI } from '@/lib/providers/introspection-api';
import { Activity, Brain, Cpu, Database, AlertCircle, CheckCircle, XCircle, Eye, Copy } from 'lucide-react-native';
import type { IntrospectionSnapshot, ReflectionResult } from '@/types/introspection';

export default function IntrospectionScreen() {
  const introspection = useIntrospectionAPI();
  const [snapshot, setSnapshot] = useState<IntrospectionSnapshot | null>(null);
  const [reflection, setReflection] = useState<ReflectionResult | null>(null);
  const [isReflecting, setIsReflecting] = useState(false);

  const captureSnapshotHandler = useCallback(() => {
    const newSnapshot = introspection.captureSnapshot();
    setSnapshot(newSnapshot);
  }, [introspection]);

  const performReflection = useCallback(async (query: string) => {
    setIsReflecting(true);
    try {
      const result = await introspection.reflect(query);
      setReflection(result);
    } catch (error) {
      console.error('Reflection failed:', error);
    } finally {
      setIsReflecting(false);
    }
  }, [introspection]);

  const performAudit = useCallback(async () => {
    setIsReflecting(true);
    try {
      const result = await introspection.auditSelf();
      setReflection(result);
    } catch (error) {
      console.error('Audit failed:', error);
    } finally {
      setIsReflecting(false);
    }
  }, [introspection]);

  React.useEffect(() => {
    captureSnapshotHandler();
    const interval = setInterval(captureSnapshotHandler, 5000);
    return () => clearInterval(interval);
  }, [captureSnapshotHandler]);

  const cognitiveState = introspection.queryCognitiveState();

  const copySnapshot = useCallback(async () => {
    if (!snapshot) return;
    try {
      const data = JSON.stringify(snapshot, null, 2);
      await Clipboard.setStringAsync(data);
      Alert.alert('Copied', 'Snapshot copied to clipboard');
    } catch (error) {
      console.error('Failed to copy snapshot:', error);
      Alert.alert('Error', 'Failed to copy snapshot');
    }
  }, [snapshot]);

  const copyReflection = useCallback(async () => {
    if (!reflection) return;
    try {
      const text = `Query: ${reflection.query}\n\nSummary: ${reflection.summary}\n\nInsights:\n${reflection.insights.map(i => `- [${i.category}] ${i.observation} (${(i.confidence * 100).toFixed(0)}% confidence)`).join('\n')}\n\nRecommendations:\n${reflection.recommendations.map(r => `- ${r}`).join('\n')}`;
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', 'Reflection results copied to clipboard');
    } catch (error) {
      console.error('Failed to copy reflection:', error);
      Alert.alert('Error', 'Failed to copy reflection');
    }
  }, [reflection]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'degraded': return '#f59e0b';
      case 'critical': return '#ef4444';
      case 'active': return '#3b82f6';
      case 'idle': return '#6b7280';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle size={16} color="#10b981" />;
      case 'degraded': return <AlertCircle size={16} color="#f59e0b" />;
      case 'critical': return <XCircle size={16} color="#ef4444" />;
      default: return <Activity size={16} color="#6b7280" />;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'System Introspection',
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#fff',
      }} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Eye size={32} color="#60a5fa" />
          <Text style={styles.title}>monGARS Introspection</Text>
          <Text style={styles.subtitle}>Real-time Self-Inspection</Text>
          {snapshot && (
            <TouchableOpacity style={styles.copyButton} onPress={copySnapshot}>
              <Copy size={16} color="#60a5fa" />
              <Text style={styles.copyButtonText}>Copy Snapshot</Text>
            </TouchableOpacity>
          )}
        </View>

        {snapshot && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Activity size={20} color="#60a5fa" />
                <Text style={styles.sectionTitle}>System Health</Text>
              </View>
              <View style={styles.card}>
                <View style={styles.healthRow}>
                  {getStatusIcon(snapshot.systemHealth.overallStatus)}
                  <Text style={[styles.healthStatus, { color: getStatusColor(snapshot.systemHealth.overallStatus) }]}>
                    {snapshot.systemHealth.overallStatus.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.metric}>
                  Uptime: {Math.floor(snapshot.systemHealth.uptime / 1000 / 60)} minutes
                </Text>
                {snapshot.systemHealth.alerts.length > 0 && (
                  <View style={styles.alertsContainer}>
                    {snapshot.systemHealth.alerts.map((alert, i) => (
                      <View key={i} style={styles.alert}>
                        <AlertCircle size={14} color="#f59e0b" />
                        <Text style={styles.alertText}>{alert}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Brain size={20} color="#60a5fa" />
                <Text style={styles.sectionTitle}>Cognitive State</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.metricLabel}>Active Modules</Text>
                <View style={styles.modulesList}>
                  {cognitiveState.modulesEngaged.slice(0, 6).map((module, i) => (
                    <View key={i} style={styles.moduleBadge}>
                      <Text style={styles.moduleBadgeText}>{module}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{cognitiveState.confidenceLevel.toFixed(2)}</Text>
                    <Text style={styles.metricLabel}>Confidence</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{cognitiveState.temperature}</Text>
                    <Text style={styles.metricLabel}>Temperature</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{cognitiveState.reasoningDepth}</Text>
                    <Text style={styles.metricLabel}>Depth</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Database size={20} color="#60a5fa" />
                <Text style={styles.sectionTitle}>Memory Context</Text>
              </View>
              <View style={styles.card}>
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{cognitiveState.memoryContext.shortTermCount}</Text>
                    <Text style={styles.metricLabel}>Short-term</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{cognitiveState.memoryContext.longTermAccessed}</Text>
                    <Text style={styles.metricLabel}>Long-term</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{cognitiveState.memoryContext.vectorSearches}</Text>
                    <Text style={styles.metricLabel}>Searches</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Cpu size={20} color="#60a5fa" />
                <Text style={styles.sectionTitle}>Subsystems ({snapshot.subsystems.length})</Text>
              </View>
              {snapshot.subsystems.slice(0, 8).map((subsystem, i) => (
                <View key={i} style={styles.subsystemCard}>
                  <View style={styles.subsystemHeader}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(subsystem.status) }]} />
                    <Text style={styles.subsystemName}>{subsystem.name}</Text>
                  </View>
                  <View style={styles.subsystemMetrics}>
                    <Text style={styles.subsystemMetric}>
                      {subsystem.metrics.operationCount} ops
                    </Text>
                    <Text style={styles.subsystemMetric}>
                      {subsystem.metrics.averageDurationMs.toFixed(0)}ms avg
                    </Text>
                    <Text style={styles.subsystemMetric}>
                      {(subsystem.metrics.cacheHitRate * 100).toFixed(0)}% cache
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Eye size={20} color="#60a5fa" />
            <Text style={styles.sectionTitle}>Reflection Commands</Text>
          </View>
          <View style={styles.buttonsContainer}>
            <TouchableOpacity 
              style={styles.button}
              onPress={() => performReflection('How is my performance?')}
              disabled={isReflecting}
            >
              <Text style={styles.buttonText}>Performance Check</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.button}
              onPress={() => performReflection('What is my health status?')}
              disabled={isReflecting}
            >
              <Text style={styles.buttonText}>Health Check</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.button}
              onPress={() => performReflection('Analyze my memory usage')}
              disabled={isReflecting}
            >
              <Text style={styles.buttonText}>Memory Analysis</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.auditButton]}
              onPress={performAudit}
              disabled={isReflecting}
            >
              <Text style={styles.buttonText}>Full Self-Audit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isReflecting && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#60a5fa" />
            <Text style={styles.loadingText}>Performing introspection...</Text>
          </View>
        )}

        {reflection && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Brain size={20} color="#60a5fa" />
              <Text style={styles.sectionTitle}>Reflection Results</Text>
              <TouchableOpacity style={styles.copyIconButton} onPress={copyReflection}>
                <Copy size={16} color="#60a5fa" />
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              <Text style={styles.reflectionQuery}>Query: {reflection.query}</Text>
              <Text style={styles.reflectionSummary}>{reflection.summary}</Text>
              
              {reflection.insights.length > 0 && (
                <View style={styles.insightsContainer}>
                  <Text style={styles.insightsTitle}>Insights:</Text>
                  {reflection.insights.map((insight, i) => (
                    <View key={i} style={styles.insight}>
                      <View style={[styles.insightBadge, { backgroundColor: getCategoryColor(insight.category) }]}>
                        <Text style={styles.insightCategory}>{insight.category}</Text>
                      </View>
                      <Text style={styles.insightText}>{insight.observation}</Text>
                      <Text style={styles.insightConfidence}>
                        {(insight.confidence * 100).toFixed(0)}% confidence
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {reflection.recommendations.length > 0 && (
                <View style={styles.recommendationsContainer}>
                  <Text style={styles.recommendationsTitle}>Recommendations:</Text>
                  {reflection.recommendations.map((rec, i) => (
                    <Text key={i} style={styles.recommendation}>• {rec}</Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'performance': return '#3b82f6';
    case 'health': return '#10b981';
    case 'behavior': return '#8b5cf6';
    case 'resources': return '#f59e0b';
    default: return '#6b7280';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#f1f5f9',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e40af',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 12,
  },
  copyButtonText: {
    color: '#dbeafe',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  copyIconButton: {
    marginLeft: 'auto' as const,
    padding: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#f1f5f9',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  healthStatus: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  metric: {
    fontSize: 14,
    color: '#cbd5e1',
    marginTop: 4,
  },
  alertsContainer: {
    marginTop: 12,
    gap: 8,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: '#422006',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#78350f',
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: '#fbbf24',
  },
  metricLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
  },
  modulesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  moduleBadge: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  moduleBadgeText: {
    fontSize: 11,
    color: '#dbeafe',
    fontWeight: '500' as const,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#60a5fa',
    marginBottom: 4,
  },
  subsystemCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  subsystemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subsystemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#f1f5f9',
  },
  subsystemMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  subsystemMetric: {
    fontSize: 12,
    color: '#94a3b8',
  },
  buttonsContainer: {
    gap: 10,
  },
  button: {
    backgroundColor: '#1e40af',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  auditButton: {
    backgroundColor: '#7c3aed',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  reflectionQuery: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  reflectionSummary: {
    fontSize: 16,
    color: '#f1f5f9',
    lineHeight: 24,
    marginBottom: 16,
  },
  insightsContainer: {
    marginTop: 12,
  },
  insightsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#60a5fa',
    marginBottom: 8,
  },
  insight: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#0f172a',
    borderRadius: 6,
  },
  insightBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  insightCategory: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
  insightText: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 4,
  },
  insightConfidence: {
    fontSize: 12,
    color: '#64748b',
  },
  recommendationsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#10b981',
    marginBottom: 8,
  },
  recommendation: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 6,
    lineHeight: 20,
  },
});
