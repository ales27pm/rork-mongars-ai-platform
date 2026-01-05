import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { usePerformanceMonitoring } from '@/lib/hooks/usePerformanceMonitoring';
import { ThermalState } from '@/lib/utils/device-metrics';

export function PerformanceMetrics() {
  const {
    currentMetrics,
    currentProfile,
    optimizationMetrics,
    isMonitoring,
    getCacheStats,
  } = usePerformanceMonitoring();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getThermalStateColor = (state: ThermalState) => {
    switch (state) {
      case ThermalState.Nominal:
        return '#4ade80';
      case ThermalState.Fair:
        return '#facc15';
      case ThermalState.Serious:
        return '#fb923c';
      case ThermalState.Critical:
        return '#f87171';
      default:
        return '#94a3b8';
    }
  };

  const cacheStats = getCacheStats();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Performance Profile</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Current Profile:</Text>
          <Text style={styles.value}>{currentProfile.name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Max Batch Size:</Text>
          <Text style={styles.value}>{currentProfile.maxBatchSize}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Max Concurrency:</Text>
          <Text style={styles.value}>{currentProfile.maxConcurrency}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Caching:</Text>
          <Text style={styles.value}>
            {currentProfile.enableCaching ? 'Enabled' : 'Disabled'}
          </Text>
        </View>
      </View>

      {currentMetrics && (
        <View style={styles.card}>
          <Text style={styles.title}>Device Metrics</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Memory Usage:</Text>
            <Text style={styles.value}>
              {currentMetrics.memoryUsagePercent.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Memory:</Text>
            <Text style={styles.value}>{formatBytes(currentMetrics.totalMemory)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Thermal State:</Text>
            <View
              style={[
                styles.thermalBadge,
                { backgroundColor: getThermalStateColor(currentMetrics.thermalState) },
              ]}
            >
              <Text style={styles.thermalText}>
                {ThermalState[currentMetrics.thermalState]}
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Battery:</Text>
            <Text style={styles.value}>
              {(currentMetrics.batteryLevel * 100).toFixed(0)}%
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Low Power Mode:</Text>
            <Text style={styles.value}>
              {currentMetrics.isLowPowerMode ? 'Yes' : 'No'}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.title}>Cache Statistics</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Cache Size:</Text>
          <Text style={styles.value}>
            {cacheStats.size} / {cacheStats.maxSize}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Utilization:</Text>
          <Text style={styles.value}>{cacheStats.utilizationPercent.toFixed(1)}%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status:</Text>
          <Text style={styles.value}>{cacheStats.enabled ? 'Enabled' : 'Disabled'}</Text>
        </View>
      </View>

      {optimizationMetrics && optimizationMetrics.optimizationsSuggested.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.title}>Optimization Suggestions</Text>
          {optimizationMetrics.optimizationsSuggested.map((suggestion, index) => (
            <Text key={index} style={styles.suggestion}>
              • {suggestion}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          Monitoring: {isMonitoring ? '🟢 Active' : '🔴 Inactive'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  thermalBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  thermalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  suggestion: {
    fontSize: 14,
    color: '#facc15',
    marginBottom: 8,
    lineHeight: 20,
  },
  statusBar: {
    padding: 16,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    color: '#a0a0a0',
  },
});
