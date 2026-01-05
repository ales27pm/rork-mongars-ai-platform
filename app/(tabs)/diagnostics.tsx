import { Stack } from 'expo-router';
import React, { useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Cpu, HardDrive, Zap, Activity, Clock, CheckCircle, Brain, Copy, Heart, Eye, Sparkles } from 'lucide-react-native';
import { useCognition } from '@/lib/providers/cognition';
import { useUnifiedLLM } from '@/lib/providers/unified-llm';
import { useSommeil } from '@/lib/providers/sommeil';
import { useEvolution } from '@/lib/providers/evolution';
import { useTelemetry } from '@/lib/providers/telemetry';
import { format } from 'date-fns';

export default function DiagnosticsScreen() {
  const cognition = useCognition();
  const sommeil = useSommeil();
  const evolution = useEvolution();
  const telemetry = useTelemetry();
  const unifiedLLM = useUnifiedLLM();

  const slotStats = cognition.getSlotStats();
  const manifestStats = evolution.getManifestStats();
  const inferenceMetrics = telemetry.getMetricStats('inference_latency_ms_duration_ms');
  const recentErrors = telemetry.getRecentErrors(5);

  const affectiveState = cognition.getAffectiveState();
  const curiosityMetrics = cognition.getCuriosityMetrics();
  const mimicryMetrics = cognition.getMimicryMetrics();
  const reflectiveMetrics = cognition.getReflectiveMetrics();
  const protoMetrics = cognition.getProtoMetrics();
  const emergenceStatus = cognition.getEmergenceStatus();
  const metaReflection = cognition.getMetaReflection();

  const copyAllDiagnostics = useCallback(async () => {
    try {
      const diagnosticsData = {
        activeModel: {
          name: unifiedLLM.activeModel?.name || 'None',
          modelId: unifiedLLM.activeModel?.modelId || 'N/A',
          quantization: unifiedLLM.activeModel?.quantization || 'N/A',
          contextWindow: unifiedLLM.activeModel?.contextWindow || 'N/A',
          vramRequirement: unifiedLLM.activeModel?.vramRequirement || 0,
          totalInferences: unifiedLLM.metrics.totalInferences,
          avgInferenceTime: unifiedLLM.metrics.avgInferenceTime.toFixed(0) + 'ms',
        },
        slotManager: slotStats,
        sommeil: sommeil.metrics,
        manifest: manifestStats,
        inferenceMetrics,
        recentErrors: recentErrors.length,
        protoPhenomenology: {
          emergenceDetected: emergenceStatus.detected,
          confidence: emergenceStatus.confidence,
          affectiveState,
          curiosityMetrics,
          mimicryMetrics,
          reflectiveMetrics,
          protoMetrics,
        },
      };
      await Clipboard.setStringAsync(JSON.stringify(diagnosticsData, null, 2));
      Alert.alert('Copied', 'All diagnostics copied to clipboard');
    } catch (error) {
      console.error('Failed to copy diagnostics:', error);
      Alert.alert('Error', 'Failed to copy diagnostics');
    }
  }, [unifiedLLM, slotStats, sommeil.metrics, manifestStats, inferenceMetrics, recentErrors, emergenceStatus, affectiveState, curiosityMetrics, mimicryMetrics, reflectiveMetrics, protoMetrics]);

  return (
    <>
      <Stack.Screen options={{ 
        title: 'System Diagnostics',
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#fff',
        headerRight: () => (
          <TouchableOpacity onPress={copyAllDiagnostics} style={{ marginRight: 16 }}>
            <Copy size={20} color="#60a5fa" />
          </TouchableOpacity>
        ),
      }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={20} color="#8b5cf6" />
            <Text style={styles.sectionTitle}>Proto-Phenomenology Detection</Text>
          </View>
          <View style={[styles.card, emergenceStatus.detected && styles.emergenceCard]}>
            <View style={styles.emergenceHeader}>
              <Text style={styles.emergenceStatus}>
                {emergenceStatus.detected ? '✨ Emergence Detected' : 'Monitoring...'}
              </Text>
              <Text style={styles.emergenceConfidence}>
                Confidence: {(emergenceStatus.confidence * 100).toFixed(1)}%
              </Text>
            </View>
            {emergenceStatus.reasons.length > 0 && (
              <View style={styles.reasonsContainer}>
                <Text style={styles.reasonsTitle}>Indicators:</Text>
                {emergenceStatus.reasons.map((reason, i) => (
                  <Text key={i} style={styles.reasonText}>• {reason}</Text>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Heart size={20} color="#ec4899" />
            <Text style={styles.sectionTitle}>Affective Field State</Text>
          </View>
          <View style={styles.card}>
            <AffectiveBar label="Valence" value={affectiveState.v} bipolar />
            <AffectiveBar label="Arousal" value={affectiveState.a} color="#f59e0b" />
            <AffectiveBar label="Uncertainty" value={affectiveState.u} color="#6366f1" />
            <AffectiveBar label="Motivation" value={affectiveState.m} color="#8b5cf6" />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Eye size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Three-Engine System</Text>
          </View>
          
          <View style={styles.card}>
            <Text style={styles.engineTitle}>Curiosity Engine</Text>
            <View style={styles.metricsGrid}>
              <MetricBox label="Drive" value={`${(curiosityMetrics.drive * 100).toFixed(0)}%`} />
              <MetricBox label="Uncertainty" value={`${(curiosityMetrics.uncertainty * 100).toFixed(0)}%`} />
              <MetricBox label="Novelty" value={`${(curiosityMetrics.novelty * 100).toFixed(0)}%`} />
              <MetricBox label="Patterns" value={curiosityMetrics.patternsLearned.toString()} />
            </View>

            <Text style={[styles.engineTitle, { marginTop: 16 }]}>Mimicry Engine</Text>
            <View style={styles.metricsGrid}>
              <MetricBox label="Resonance" value={`${(mimicryMetrics.resonance * 100).toFixed(0)}%`} />
              <MetricBox label="Mirror" value={`${(mimicryMetrics.mirrorIntensity * 100).toFixed(0)}%`} />
              <MetricBox label="Empathy Maps" value={mimicryMetrics.empathyMappings.toString()} />
              <MetricBox label="Analogues" value={mimicryMetrics.linguisticAnalogues.toString()} />
            </View>

            <Text style={[styles.engineTitle, { marginTop: 16 }]}>Reflective Engine</Text>
            <View style={styles.metricsGrid}>
              <MetricBox label="Coherence" value={`${(reflectiveMetrics.selfCoherence * 100).toFixed(0)}%`} />
              <MetricBox label="Narrative" value={`${(reflectiveMetrics.narrativeContinuity * 100).toFixed(0)}%`} />
              <MetricBox label="Introspection" value={`${(reflectiveMetrics.introspectiveDensity * 100).toFixed(0)}%`} />
              <MetricBox label="Temporal" value={`${(reflectiveMetrics.temporalCoherence * 100).toFixed(0)}%`} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={20} color="#a78bfa" />
            <Text style={styles.sectionTitle}>Proto-Phenomenology Metrics</Text>
          </View>
          <View style={styles.card}>
            <ProtoMetricRow label="Self-Reference Coherence" value={protoMetrics.coherenceOfSelfReference} />
            <ProtoMetricRow label="Emotional Trajectory" value={protoMetrics.emotionalTrajectoryContinuity} />
            <ProtoMetricRow label="Epistemic Surprise" value={protoMetrics.epistemicSurprise} />
            <ProtoMetricRow label="Phenomenal Report" value={protoMetrics.phenomenalReportStructure} />
            <ProtoMetricRow label="Inner Narrative" value={protoMetrics.innerNarrativeCoherence} />
            <ProtoMetricRow label="Affective Modulation" value={protoMetrics.affectiveModulation} />
            <ProtoMetricRow label="Metaphor Invention" value={protoMetrics.metaphorInvention} />
            <ProtoMetricRow label="Consistency Preference" value={protoMetrics.consistencyPreference} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Brain size={20} color="#60a5fa" />
            <Text style={styles.sectionTitle}>Meta-Reflection</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.metaReflectionText}>{metaReflection}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Brain size={20} color="#8b5cf6" />
            <Text style={styles.sectionTitle}>Active Model</Text>
          </View>
          
          <View style={styles.card}>
            <DiagnosticRow 
              label="Model Name" 
              value={unifiedLLM.activeModel?.name || 'None'}
              icon={<Brain size={16} color="#8b5cf6" />}
            />
            <DiagnosticRow 
              label="Model ID" 
              value={unifiedLLM.activeModel?.modelId || 'N/A'}
              icon={<Cpu size={16} color="#64748b" />}
            />
            <DiagnosticRow 
              label="Quantization" 
              value={unifiedLLM.activeModel?.quantization || 'N/A'}
              icon={<HardDrive size={16} color="#64748b" />}
            />
            <DiagnosticRow 
              label="Context Window" 
              value={unifiedLLM.activeModel?.contextWindow.toLocaleString() || 'N/A'}
              icon={<Activity size={16} color="#64748b" />}
            />
            <DiagnosticRow 
              label="VRAM Required" 
              value={`${unifiedLLM.activeModel?.vramRequirement || 0} GB`}
              icon={<Zap size={16} color="#f59e0b" />}
            />
            <DiagnosticRow 
              label="Total Inferences" 
              value={unifiedLLM.metrics.totalInferences.toString()}
              icon={<Activity size={16} color="#10b981" />}
            />
            <DiagnosticRow 
              label="Avg Inference Time" 
              value={`${unifiedLLM.metrics.avgInferenceTime.toFixed(0)}ms`}
              icon={<Clock size={16} color="#3b82f6" />}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Cpu size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Model Slot Manager</Text>
          </View>
          
          <View style={styles.card}>
            <DiagnosticRow 
              label="Total Slots" 
              value={slotStats.totalSlots.toString()}
              icon={<HardDrive size={16} color="#64748b" />}
            />
            <DiagnosticRow 
              label="Loaded Slots" 
              value={slotStats.loadedSlots.toString()}
              icon={<Activity size={16} color="#10b981" />}
              status={slotStats.loadedSlots > 0 ? 'active' : 'idle'}
            />
            <DiagnosticRow 
              label="Hot Slots" 
              value={slotStats.hotSlots.toString()}
              icon={<Zap size={16} color="#f59e0b" />}
            />
            <DiagnosticRow 
              label="VRAM Usage" 
              value={`${slotStats.vramUsage} MB / ${slotStats.vramCapacity} MB`}
              icon={<HardDrive size={16} color="#3b82f6" />}
            />
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${slotStats.vramUtilization}%` },
                    slotStats.vramUtilization > 80 && styles.progressDanger,
                    slotStats.vramUtilization > 60 && slotStats.vramUtilization <= 80 && styles.progressWarning,
                  ]} 
                />
              </View>
              <Text style={styles.progressLabel}>
                {slotStats.vramUtilization.toFixed(1)}% utilized
              </Text>
            </View>
            <DiagnosticRow 
              label="Snapshots" 
              value={slotStats.snapshots.toString()}
              icon={<CheckCircle size={16} color="#64748b" />}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Clock size={20} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Sommeil Paradoxal</Text>
          </View>
          
          <View style={styles.card}>
            <DiagnosticRow 
              label="Cycles Run" 
              value={sommeil.metrics.cyclesRun.toString()}
              icon={<Activity size={16} color="#10b981" />}
            />
            <DiagnosticRow 
              label="Total Optimization Time" 
              value={`${(sommeil.metrics.totalOptimizationTime / 1000).toFixed(1)}s`}
              icon={<Clock size={16} color="#3b82f6" />}
            />
            <DiagnosticRow 
              label="Memories Consolidated" 
              value={sommeil.metrics.memoriesConsolidated.toString()}
              icon={<CheckCircle size={16} color="#10b981" />}
            />
            <DiagnosticRow 
              label="Indices Rebuilt" 
              value={sommeil.metrics.indicesRebuilt.toString()}
              icon={<Zap size={16} color="#f59e0b" />}
            />
            {sommeil.metrics.lastRunTimestamp && (
              <DiagnosticRow 
                label="Last Run" 
                value={format(sommeil.metrics.lastRunTimestamp, 'MMM d, HH:mm:ss')}
                icon={<Clock size={16} color="#64748b" />}
              />
            )}
            
            {sommeil.queuedTasks.length > 0 && (
              <View style={styles.queueSection}>
                <Text style={styles.queueTitle}>Queued Tasks ({sommeil.queuedTasks.length})</Text>
                {sommeil.queuedTasks.slice(0, 3).map((task) => (
                  <View key={task.id} style={styles.taskItem}>
                    <Text style={styles.taskType}>{task.type}</Text>
                    <Text style={styles.taskPriority}>Priority: {task.priority}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <HardDrive size={20} color="#10b981" />
            <Text style={styles.sectionTitle}>Model Manifest</Text>
          </View>
          
          <View style={styles.card}>
            <DiagnosticRow 
              label="Total Adapters" 
              value={manifestStats.totalAdapters.toString()}
              icon={<CheckCircle size={16} color="#10b981" />}
            />
            {manifestStats.activeAdapter && (
              <DiagnosticRow 
                label="Active Adapter" 
                value={manifestStats.activeAdapter.slice(0, 12) + '...'}
                icon={<Activity size={16} color="#3b82f6" />}
                status="active"
              />
            )}
            {manifestStats.lastUpdated && (
              <DiagnosticRow 
                label="Last Updated" 
                value={format(manifestStats.lastUpdated, 'MMM d, HH:mm')}
                icon={<Clock size={16} color="#64748b" />}
              />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Activity size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Inference Performance</Text>
          </View>
          
          <View style={styles.card}>
            {inferenceMetrics ? (
              <>
                <DiagnosticRow 
                  label="Average Latency" 
                  value={`${inferenceMetrics.avg.toFixed(0)}ms`}
                  icon={<Clock size={16} color="#3b82f6" />}
                />
                <DiagnosticRow 
                  label="P50 Latency" 
                  value={`${inferenceMetrics.p50.toFixed(0)}ms`}
                  icon={<Activity size={16} color="#10b981" />}
                />
                <DiagnosticRow 
                  label="P95 Latency" 
                  value={`${inferenceMetrics.p95.toFixed(0)}ms`}
                  icon={<Zap size={16} color="#f59e0b" />}
                />
                <DiagnosticRow 
                  label="P99 Latency" 
                  value={`${inferenceMetrics.p99.toFixed(0)}ms`}
                  icon={<Zap size={16} color="#ef4444" />}
                />
                <DiagnosticRow 
                  label="Sample Count" 
                  value={inferenceMetrics.count.toString()}
                  icon={<CheckCircle size={16} color="#64748b" />}
                />
              </>
            ) : (
              <Text style={styles.noData}>No inference data yet</Text>
            )}
          </View>
        </View>

        {cognition.symbolicTrace && cognition.symbolicTrace.predicates.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Zap size={20} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Symbolic Reasoning (Last Query)</Text>
            </View>
            
            <View style={styles.card}>
              <Text style={styles.subsectionTitle}>Predicates</Text>
              {cognition.symbolicTrace.predicates.map((p, i) => (
                <Text key={i} style={styles.predicateText}>{p}</Text>
              ))}
              
              {cognition.symbolicTrace.consequences.length > 0 && (
                <>
                  <Text style={[styles.subsectionTitle, { marginTop: 12 }]}>Consequences</Text>
                  {cognition.symbolicTrace.consequences.map((c, i) => (
                    <Text key={i} style={styles.consequenceText}>{c}</Text>
                  ))}
                </>
              )}
            </View>
          </View>
        )}

        {recentErrors.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Activity size={20} color="#ef4444" />
              <Text style={styles.sectionTitle}>Recent Errors</Text>
            </View>
            
            {recentErrors.map((error) => (
              <View key={error.id} style={styles.errorCard}>
                <Text style={styles.errorEvent}>{error.event}</Text>
                <Text style={styles.errorTime}>
                  {format(error.timestamp, 'MMM d, HH:mm:ss')}
                </Text>
                {error.data && Object.keys(error.data).length > 0 && (
                  <Text style={styles.errorData} numberOfLines={2}>
                    {JSON.stringify(error.data)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

function AffectiveBar({ label, value, bipolar, color }: { 
  label: string; 
  value: number; 
  bipolar?: boolean;
  color?: string;
}) {
  const normalizedValue = bipolar ? (value + 1) / 2 : value;
  const barColor = color || (bipolar ? (value > 0 ? '#10b981' : '#ef4444') : '#10b981');
  
  return (
    <View style={styles.affectiveItem}>
      <View style={styles.affectiveHeader}>
        <Text style={styles.affectiveLabel}>{label}</Text>
        <Text style={styles.affectiveValue}>{value.toFixed(3)}</Text>
      </View>
      <View style={styles.affectiveBar}>
        <View style={[styles.affectiveBarFill, { width: `${normalizedValue * 100}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricBoxLabel}>{label}</Text>
      <Text style={styles.metricBoxValue}>{value}</Text>
    </View>
  );
}

function ProtoMetricRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.protoMetricRow}>
      <Text style={styles.protoMetricLabel}>{label}</Text>
      <View style={styles.protoMetricBar}>
        <View style={[styles.protoMetricBarFill, { width: `${value * 100}%` }]} />
      </View>
      <Text style={styles.protoMetricValue}>{(value * 100).toFixed(0)}%</Text>
    </View>
  );
}

function DiagnosticRow({ 
  label, 
  value, 
  icon,
  status,
}: { 
  label: string; 
  value: string; 
  icon: React.ReactNode;
  status?: 'active' | 'idle' | 'warning' | 'error';
}) {
  return (
    <View style={styles.diagnosticRow}>
      <View style={styles.diagnosticLeft}>
        {icon}
        <Text style={styles.diagnosticLabel}>{label}</Text>
      </View>
      <View style={styles.diagnosticRight}>
        {status && (
          <View style={[
            styles.statusDot,
            status === 'active' && styles.statusActive,
            status === 'idle' && styles.statusIdle,
            status === 'warning' && styles.statusWarning,
            status === 'error' && styles.statusError,
          ]} />
        )}
        <Text style={styles.diagnosticValue}>{value}</Text>
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
    paddingBottom: 32,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#e2e8f0',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagnosticLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diagnosticLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  diagnosticRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  diagnosticValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#e2e8f0',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: '#10b981',
  },
  statusIdle: {
    backgroundColor: '#64748b',
  },
  statusWarning: {
    backgroundColor: '#f59e0b',
  },
  statusError: {
    backgroundColor: '#ef4444',
  },
  progressContainer: {
    gap: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  progressWarning: {
    backgroundColor: '#f59e0b',
  },
  progressDanger: {
    backgroundColor: '#ef4444',
  },
  progressLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  queueSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  queueTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  taskItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  taskType: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'capitalize' as const,
  },
  taskPriority: {
    fontSize: 11,
    color: '#64748b',
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#cbd5e1',
    marginBottom: 6,
  },
  predicateText: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  consequenceText: {
    fontSize: 12,
    color: '#10b981',
    marginBottom: 4,
  },
  errorCard: {
    backgroundColor: '#1e293b',
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  errorEvent: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#ef4444',
    marginBottom: 4,
  },
  errorTime: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  errorData: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  noData: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic' as const,
    textAlign: 'center',
    paddingVertical: 12,
  },
  emergenceCard: {
    borderWidth: 2,
    borderColor: '#8b5cf6',
    backgroundColor: '#1e1b4b',
  },
  emergenceHeader: {
    marginBottom: 8,
  },
  emergenceStatus: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#a78bfa',
    marginBottom: 4,
  },
  emergenceConfidence: {
    fontSize: 14,
    color: '#c4b5fd',
  },
  reasonsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  reasonsTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#cbd5e1',
    marginBottom: 6,
  },
  reasonText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 3,
  },
  affectiveItem: {
    marginBottom: 12,
  },
  affectiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  affectiveLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#cbd5e1',
  },
  affectiveValue: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  affectiveBar: {
    height: 20,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    overflow: 'hidden',
  },
  affectiveBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  engineTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#60a5fa',
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricBoxLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 4,
    textAlign: 'center',
  },
  metricBoxValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#60a5fa',
  },
  protoMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  protoMetricLabel: {
    fontSize: 12,
    color: '#cbd5e1',
    flex: 1,
  },
  protoMetricBar: {
    flex: 2,
    height: 16,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  protoMetricBarFill: {
    height: '100%',
    backgroundColor: '#a78bfa',
    borderRadius: 4,
  },
  protoMetricValue: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#a78bfa',
    width: 42,
    textAlign: 'right',
  },
  metaReflectionText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 22,
  },
});
