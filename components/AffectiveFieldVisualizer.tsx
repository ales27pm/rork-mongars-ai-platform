import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AffectiveField } from '@/types/affective';

interface AffectiveFieldVisualizerProps {
  field: AffectiveField;
  width?: number;
  height?: number;
}

export function AffectiveFieldVisualizer({ field }: AffectiveFieldVisualizerProps) {

  const getValenceColor = (v: number) => {
    if (v > 0) {
      const intensity = Math.floor(v * 255);
      return `rgb(${Math.floor(16 + intensity * 0.3)}, ${Math.floor(185 + intensity * 0.3)}, ${Math.floor(129)})`;
    } else {
      const intensity = Math.floor(Math.abs(v) * 255);
      return `rgb(${Math.floor(239)}, ${Math.floor(68 + intensity * 0.3)}, ${Math.floor(68)})`;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Affective Field State</Text>
        <Text style={styles.timestamp}>
          {new Date(field.timestamp).toLocaleTimeString()}
        </Text>
      </View>

      <View style={styles.gridContainer}>
        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.label}>Valence</Text>
            <View style={styles.barContainer}>
              <View 
                style={[
                  styles.bar, 
                  { 
                    width: `${Math.abs(field.v) * 100}%`,
                    backgroundColor: getValenceColor(field.v),
                    alignSelf: field.v >= 0 ? 'flex-start' : 'flex-end',
                  }
                ]} 
              />
            </View>
            <Text style={styles.value}>{field.v.toFixed(3)}</Text>
          </View>

          <View style={styles.metric}>
            <Text style={styles.label}>Arousal</Text>
            <View style={styles.barContainer}>
              <View 
                style={[
                  styles.bar, 
                  { 
                    width: `${field.a * 100}%`,
                    backgroundColor: '#f59e0b',
                  }
                ]} 
              />
            </View>
            <Text style={styles.value}>{field.a.toFixed(3)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.label}>Uncertainty</Text>
            <View style={styles.barContainer}>
              <View 
                style={[
                  styles.bar, 
                  { 
                    width: `${field.u * 100}%`,
                    backgroundColor: '#8b5cf6',
                  }
                ]} 
              />
            </View>
            <Text style={styles.value}>{field.u.toFixed(3)}</Text>
          </View>

          <View style={styles.metric}>
            <Text style={styles.label}>Motivation</Text>
            <View style={styles.barContainer}>
              <View 
                style={[
                  styles.bar, 
                  { 
                    width: `${field.m * 100}%`,
                    backgroundColor: '#3b82f6',
                  }
                ]} 
              />
            </View>
            <Text style={styles.value}>{field.m.toFixed(3)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.phaseSpace}>
        <Text style={styles.phaseLabel}>Valence-Arousal Phase Space</Text>
        <View style={styles.phaseGrid}>
          <View style={styles.phaseAxes}>
            <View style={styles.verticalAxis} />
            <View style={styles.horizontalAxis} />
          </View>
          <View 
            style={[
              styles.phasePoint,
              {
                left: `${((field.v + 1) / 2) * 100}%`,
                bottom: `${field.a * 100}%`,
              }
            ]}
          >
            <View style={styles.phasePointInner} />
          </View>
        </View>
        <View style={styles.phaseLabels}>
          <Text style={styles.axisLabel}>Negative</Text>
          <Text style={styles.axisLabel}>Positive</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  timestamp: {
    fontSize: 12,
    color: '#64748b',
  },
  gridContainer: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  metric: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
  barContainer: {
    height: 24,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 6,
  },
  value: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#cbd5e1',
    textAlign: 'right',
  },
  phaseSpace: {
    marginTop: 8,
  },
  phaseLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
    marginBottom: 8,
  },
  phaseGrid: {
    height: 150,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    position: 'relative',
  },
  phaseAxes: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalAxis: {
    position: 'absolute',
    left: '50%',
    height: '100%',
    width: 1,
    backgroundColor: '#334155',
  },
  horizontalAxis: {
    position: 'absolute',
    top: '50%',
    width: '100%',
    height: 1,
    backgroundColor: '#334155',
  },
  phasePoint: {
    position: 'absolute',
    width: 20,
    height: 20,
    marginLeft: -10,
    marginBottom: -10,
  },
  phasePointInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    borderWidth: 3,
    borderColor: '#60a5fa',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  phaseLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  axisLabel: {
    fontSize: 11,
    color: '#64748b',
  },
});
