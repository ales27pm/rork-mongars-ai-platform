import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import {
  Download,
  Play,
  Pause,
  Trash2,
  Check,
  Settings,
  HardDrive,
  Cpu,
  Zap,
  Shield,
  Package,
  FileDown,
  CheckCircle,
  AlertCircle,
  Loader,
} from "lucide-react-native";
import { useModelManager } from "@/lib/providers/model-manager";
import { modelDownloadService } from "@/lib/services/ModelDownloadService";
import { LLMModel, DownloadProgress } from "@/types/model-manager";

export default function ModelsScreen() {
  const {
    models,
    settings,
    loadedModelId,
    downloadProgress,
    isLoading,
    diskSpaceAvailable,
    downloadModel,
    cancelDownload,
    deleteModel,
    loadModel,
    unloadModel,
    updateSettings,
    canDownload,
  } = useModelManager();

  const [showSettings, setShowSettings] = useState(false);

  const handleDownload = async (model: LLMModel) => {
    if (model.format === "mlx" && Platform.OS !== "ios") {
      Alert.alert(
        "Unsupported Platform",
        "MLX downloads require iOS 18+ devices.",
      );
      return;
    }

    if (!canDownload(model.id)) {
      Alert.alert(
        "Insufficient Storage",
        "Not enough disk space to download this model.",
      );
      return;
    }

    const success = await downloadModel(model.id);
    if (success) {
      Alert.alert("Success", "Model downloaded successfully!");
    } else {
      Alert.alert("Error", "Failed to download model. Please try again.");
    }
  };

  const handleDelete = (model: LLMModel) => {
    Alert.alert(
      "Delete Model",
      `Are you sure you want to delete ${model.displayName}? This will free up ${model.sizeFormatted} of storage.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const success = await deleteModel(model.id);
            if (success) {
              Alert.alert("Deleted", "Model deleted successfully.");
            }
          },
        },
      ],
    );
  };

  const handleLoad = async (modelId: string) => {
    const success = await loadModel(modelId);
    if (success) {
      Alert.alert("Success", "Model loaded successfully!");
    } else {
      Alert.alert("Error", "Failed to load model. Please try again.");
    }
  };

  const handleUnload = async () => {
    await unloadModel();
    Alert.alert("Unloaded", "Model unloaded successfully.");
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Local Models",
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#fff",
          headerRight: () => (
            <TouchableOpacity onPress={() => setShowSettings(!showSettings)}>
              <Settings size={24} color="#3b82f6" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <HardDrive size={24} color="#3b82f6" />
              <Text style={styles.statLabel}>Available</Text>
              <Text style={styles.statValue}>
                {modelDownloadService.formatBytes(diskSpaceAvailable)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Package size={24} color="#10b981" />
              <Text style={styles.statLabel}>Downloaded</Text>
              <Text style={styles.statValue}>
                {models.filter((m) => m.isDownloaded).length}/{models.length}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Zap size={24} color="#f59e0b" />
              <Text style={styles.statLabel}>Loaded</Text>
              <Text style={styles.statValue}>{loadedModelId ? "1" : "0"}</Text>
            </View>
          </View>
        </View>

        {showSettings && (
          <View style={styles.settingsPanel}>
            <Text style={styles.sectionTitle}>Model Settings</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Shield size={20} color="#3b82f6" />
                <Text style={styles.settingLabel}>Enable Encryption</Text>
              </View>
              <Switch
                value={settings.enableEncryption}
                onValueChange={(value) =>
                  updateSettings({ enableEncryption: value })
                }
                trackColor={{ false: "#334155", true: "#3b82f6" }}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Cpu size={20} color="#3b82f6" />
                <Text style={styles.settingLabel}>Compute Units</Text>
              </View>
              <View style={styles.segmentedControl}>
                {(["all", "cpuAndGPU", "cpuOnly"] as const).map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    style={[
                      styles.segment,
                      settings.computeUnits === unit && styles.segmentActive,
                    ]}
                    onPress={() => updateSettings({ computeUnits: unit })}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        settings.computeUnits === unit &&
                          styles.segmentTextActive,
                      ]}
                    >
                      {unit === "all"
                        ? "All"
                        : unit === "cpuAndGPU"
                          ? "CPU+GPU"
                          : "CPU"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Max Batch Size</Text>
                <Text style={styles.settingDescription}>
                  Current: {settings.maxBatchSize}
                </Text>
              </View>
              <View style={styles.batchSizeControls}>
                {[4, 8, 16, 32].map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.batchSizeButton,
                      settings.maxBatchSize === size &&
                        styles.batchSizeButtonActive,
                    ]}
                    onPress={() => updateSettings({ maxBatchSize: size })}
                  >
                    <Text
                      style={[
                        styles.batchSizeText,
                        settings.maxBatchSize === size &&
                          styles.batchSizeTextActive,
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Available Models</Text>

        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            isLoaded={loadedModelId === model.id}
            progress={downloadProgress.get(model.id)}
            isLoadingModel={isLoading}
            onDownload={() => handleDownload(model)}
            onDelete={() => handleDelete(model)}
            onLoad={() => handleLoad(model.id)}
            onUnload={handleUnload}
            onCancel={() => cancelDownload(model.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface ModelCardProps {
  model: LLMModel;
  isLoaded: boolean;
  progress?: DownloadProgress;
  isLoadingModel: boolean;
  onDownload: () => void;
  onDelete: () => void;
  onLoad: () => void;
  onUnload: () => void;
  onCancel: () => void;
}

function DownloadProgressDisplay({ progress }: { progress: DownloadProgress }) {
  const getPhaseIcon = () => {
    switch (progress.phase) {
      case "init":
      case "fetching_repo":
        return <Loader size={16} color="#3b82f6" />;
      case "downloading_files":
        return <FileDown size={16} color="#3b82f6" />;
      case "verifying":
        return <CheckCircle size={16} color="#10b981" />;
      case "finalizing":
        return <Package size={16} color="#f59e0b" />;
      default:
        return <Download size={16} color="#3b82f6" />;
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case "error":
        return "#ef4444";
      case "completed":
        return "#10b981";
      case "verifying":
        return "#f59e0b";
      case "fetching":
        return "#8b5cf6";
      default:
        return "#3b82f6";
    }
  };

  const isIndeterminate = progress.phase === "init" || progress.phase === "fetching_repo";

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <View style={styles.progressPhase}>
          {getPhaseIcon()}
          <Text style={styles.progressPhaseText}>
            {progress.statusMessage || "Downloading..."}
          </Text>
        </View>
        {progress.status === "error" && (
          <AlertCircle size={16} color="#ef4444" />
        )}
      </View>

      <View style={styles.progressBar}>
        {isIndeterminate ? (
          <View style={styles.indeterminateBar}>
            <View style={[styles.indeterminateFill, { backgroundColor: getStatusColor() }]} />
          </View>
        ) : (
          <View
            style={[
              styles.progressFill,
              { 
                width: `${Math.min(progress.percentage, 100)}%`,
                backgroundColor: getStatusColor(),
              },
            ]}
          />
        )}
      </View>

      <View style={styles.progressDetails}>
        <View style={styles.progressStats}>
          <Text style={styles.progressPercentage}>
            {progress.percentage.toFixed(1)}%
          </Text>
          {progress.totalFiles && progress.currentFileIndex && (
            <Text style={styles.progressFileCount}>
              File {progress.currentFileIndex}/{progress.totalFiles}
            </Text>
          )}
        </View>
        
        <View style={styles.progressMeta}>
          {progress.speed > 0 && (
            <Text style={styles.progressSpeed}>
              {modelDownloadService.formatSpeed(progress.speed)}
            </Text>
          )}
          {progress.estimatedTimeRemaining > 0 && progress.status === "downloading" && (
            <Text style={styles.progressEta}>
              ETA: {modelDownloadService.formatTime(progress.estimatedTimeRemaining)}
            </Text>
          )}
        </View>
      </View>

      {progress.currentFile && progress.phase === "downloading_files" && (
        <View style={styles.currentFileContainer}>
          <Text style={styles.currentFileLabel}>Current file:</Text>
          <Text style={styles.currentFileName} numberOfLines={1}>
            {progress.currentFile}
          </Text>
        </View>
      )}

      {progress.bytesDownloaded > 0 && (
        <Text style={styles.progressBytes}>
          {modelDownloadService.formatBytes(progress.bytesDownloaded)} / {modelDownloadService.formatBytes(progress.totalBytes)}
        </Text>
      )}

      {progress.error && (
        <View style={styles.errorContainer}>
          <AlertCircle size={14} color="#ef4444" />
          <Text style={styles.errorText}>{progress.error}</Text>
        </View>
      )}
    </View>
  );
}

function ModelCard({
  model,
  isLoaded,
  progress,
  isLoadingModel,
  onDownload,
  onDelete,
  onLoad,
  onUnload,
  onCancel,
}: ModelCardProps) {
  const getQuantizationColor = (quantization: string) => {
    switch (quantization) {
      case "int4":
        return "#10b981";
      case "int8":
        return "#3b82f6";
      case "float16":
        return "#f59e0b";
      case "float32":
        return "#ef4444";
      default:
        return "#64748b";
    }
  };

  const isMLXUnsupported = model.format === "mlx" && Platform.OS !== "ios";

  return (
    <View style={styles.modelCard}>
      <View style={styles.modelHeader}>
        <View style={styles.modelInfo}>
          <Text style={styles.modelName}>{model.displayName}</Text>
          <Text style={styles.modelDescription}>{model.description}</Text>
        </View>
        {isLoaded && (
          <View style={styles.loadedBadge}>
            <Check size={16} color="#10b981" />
            <Text style={styles.loadedText}>Loaded</Text>
          </View>
        )}
      </View>

      <View style={styles.modelMeta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Size</Text>
          <Text style={styles.metaValue}>{model.sizeFormatted}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Format</Text>
          <View style={styles.formatBadge}>
            <Text style={styles.formatText}>
              {(model.format ?? "coreml").toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Parameters</Text>
          <Text style={styles.metaValue}>{model.parameters}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Context</Text>
          <Text style={styles.metaValue}>{model.contextLength}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Quantization</Text>
          <View
            style={[
              styles.quantizationBadge,
              { backgroundColor: getQuantizationColor(model.quantization) },
            ]}
          >
            <Text style={styles.quantizationText}>
              {model.quantization.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.capabilitiesContainer}>
        {model.capabilities.map((capability) => (
          <View key={capability.type} style={styles.capabilityTag}>
            <Text style={styles.capabilityText}>{capability.type}</Text>
          </View>
        ))}
      </View>

      {model.format === "mlx" && Platform.OS !== "ios" && (
        <View style={styles.platformWarning}>
          <Text style={styles.platformWarningText}>
            ⚠️ MLX downloads require iOS 18+ devices
          </Text>
        </View>
      )}

      {(model.isDownloading || progress) && progress && (
        <DownloadProgressDisplay progress={progress} />
      )}

      <View style={styles.modelActions}>
        {!model.isDownloaded && !model.isDownloading && (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              isMLXUnsupported && styles.disabledButton,
            ]}
            onPress={onDownload}
            disabled={isMLXUnsupported}
          >
            <Download size={18} color="#fff" />
            <Text style={styles.buttonText}>Download</Text>
          </TouchableOpacity>
        )}

        {model.isDownloading && (
          <TouchableOpacity style={styles.dangerButton} onPress={onCancel}>
            <Pause size={18} color="#fff" />
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {model.isDownloaded && !isLoaded && (
          <>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                isLoadingModel && styles.disabledButton,
              ]}
              onPress={onLoad}
              disabled={isLoadingModel}
            >
              <Play size={18} color="#fff" />
              <Text style={styles.buttonText}>
                {isLoadingModel ? "Loading..." : "Load"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={onDelete}>
              <Trash2 size={18} color="#ef4444" />
            </TouchableOpacity>
          </>
        )}

        {isLoaded && (
          <TouchableOpacity style={styles.warningButton} onPress={onUnload}>
            <Pause size={18} color="#fff" />
            <Text style={styles.buttonText}>Unload</Text>
          </TouchableOpacity>
        )}
      </View>

      {Platform.OS === "web" && (
        <View style={styles.webWarning}>
          <Text style={styles.webWarningText}>
            ⚠️ Model downloads are only available on iOS/Android
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  header: {
    gap: 16,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: 12,
  },
  statValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  settingsPanel: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  settingInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  settingDescription: {
    color: "#94a3b8",
    fontSize: 12,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 2,
  },
  segment: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: "#3b82f6",
  },
  segmentText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#fff",
  },
  batchSizeControls: {
    flexDirection: "row",
    gap: 8,
  },
  batchSizeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
  },
  batchSizeButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  batchSizeText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  batchSizeTextActive: {
    color: "#fff",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  modelCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  modelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  modelInfo: {
    flex: 1,
    gap: 4,
  },
  modelName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modelDescription: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 18,
  },
  loadedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10b98120",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  loadedText: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "600",
  },
  modelMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: {
    gap: 4,
  },
  metaLabel: {
    color: "#64748b",
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  metaValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  quantizationBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  quantizationText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  formatBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: "#334155",
  },
  formatText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "700",
  },
  capabilitiesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  capabilityTag: {
    backgroundColor: "#334155",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  capabilityText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  progressContainer: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressPhase: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  progressPhaseText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#1e293b",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  indeterminateBar: {
    height: "100%",
    width: "100%",
    overflow: "hidden",
  },
  indeterminateFill: {
    height: "100%",
    width: "30%",
    borderRadius: 3,
  },
  progressDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressPercentage: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  progressFileCount: {
    color: "#64748b",
    fontSize: 12,
  },
  progressMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressSpeed: {
    color: "#3b82f6",
    fontSize: 12,
    fontWeight: "600",
  },
  progressEta: {
    color: "#94a3b8",
    fontSize: 12,
  },
  currentFileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1e293b",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  currentFileLabel: {
    color: "#64748b",
    fontSize: 11,
  },
  currentFileName: {
    color: "#94a3b8",
    fontSize: 11,
    flex: 1,
  },
  progressBytes: {
    color: "#64748b",
    fontSize: 11,
    textAlign: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ef444420",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    flex: 1,
  },
  modelActions: {
    flexDirection: "row",
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#334155",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dangerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  warningButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f59e0b",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  webWarning: {
    backgroundColor: "#f59e0b20",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f59e0b40",
  },
  webWarningText: {
    color: "#f59e0b",
    fontSize: 12,
    textAlign: "center",
  },
  platformWarning: {
    backgroundColor: "#f59e0b20",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f59e0b40",
  },
  platformWarningText: {
    color: "#f59e0b",
    fontSize: 12,
    textAlign: "center",
  },
});
