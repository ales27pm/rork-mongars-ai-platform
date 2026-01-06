import { useState, useEffect, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LLMModel, ModelSettings, DEFAULT_MODEL_SETTINGS, AVAILABLE_MODELS, DownloadProgress } from '@/types/model-manager';
import { modelDownloadService } from '@/lib/services/ModelDownloadService';
import { localModelManager } from '@/lib/utils/local-model-manager';
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  SETTINGS: 'llm-model-settings',
  DOWNLOADED_MODELS: 'llm-downloaded-models',
};

export const [ModelManagerProvider, useModelManager] = createContextHook(() => {
  const [models, setModels] = useState<LLMModel[]>(AVAILABLE_MODELS);
  const [settings, setSettings] = useState<ModelSettings>(DEFAULT_MODEL_SETTINGS);
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgress>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [diskSpaceAvailable, setDiskSpaceAvailable] = useState<number>(0);

  const loadSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[ModelManager] Failed to load settings:', error);
    }
  }, []);

  const saveSettings = useCallback(async (newSettings: ModelSettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('[ModelManager] Failed to save settings:', error);
    }
  }, []);

  const checkDownloadedModels = useCallback(async () => {
    if (Platform.OS === 'web') return;

    try {
      const updatedModels = await Promise.all(
        AVAILABLE_MODELS.map(async (model) => {
          const isDownloaded = await modelDownloadService.isModelDownloaded(model.id);
          return { ...model, isDownloaded };
        })
      );
      setModels(updatedModels);
    } catch (error) {
      console.error('[ModelManager] Failed to check downloaded models:', error);
    }
  }, []);

  const updateDiskSpace = useCallback(async () => {
    try {
      const space = await modelDownloadService.getDiskSpaceAvailable();
      setDiskSpaceAvailable(space);
    } catch (error) {
      console.error('[ModelManager] Failed to get disk space:', error);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    checkDownloadedModels();
    updateDiskSpace();
  }, [loadSettings, checkDownloadedModels, updateDiskSpace]);

  const downloadModel = useCallback(async (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (!model) return false;

    setModels((prev) =>
      prev.map((m) =>
        m.id === modelId ? { ...m, isDownloading: true, downloadProgress: 0 } : m
      )
    );

    const success = await modelDownloadService.downloadModel(
      model,
      (progress) => {
        setDownloadProgress((prev) => new Map(prev).set(modelId, progress));
        setModels((prev) =>
          prev.map((m) =>
            m.id === modelId ? { ...m, downloadProgress: progress.percentage } : m
          )
        );
      }
    );

    setModels((prev) =>
      prev.map((m) =>
        m.id === modelId
          ? {
              ...m,
              isDownloading: false,
              isDownloaded: success,
              downloadProgress: success ? 100 : 0,
            }
          : m
      )
    );

    if (success) {
      setDownloadProgress((prev) => {
        const newMap = new Map(prev);
        newMap.delete(modelId);
        return newMap;
      });
      await updateDiskSpace();
    }

    return success;
  }, [models, updateDiskSpace]);

  const pauseDownload = useCallback(async (modelId: string) => {
    await modelDownloadService.pauseDownload(modelId);
  }, []);

  const resumeDownload = useCallback(async (modelId: string) => {
    await modelDownloadService.resumeDownload(modelId);
  }, []);

  const cancelDownload = useCallback(async (modelId: string) => {
    await modelDownloadService.cancelDownload(modelId);
    setModels((prev) =>
      prev.map((m) =>
        m.id === modelId
          ? { ...m, isDownloading: false, downloadProgress: 0 }
          : m
      )
    );
    setDownloadProgress((prev) => {
      const newMap = new Map(prev);
      newMap.delete(modelId);
      return newMap;
    });
  }, []);

  const unloadModel = useCallback(async () => {
    if (!loadedModelId) return;

    console.log('[ModelManager] Unloading model:', loadedModelId);
    setModels((prev) =>
      prev.map((m) => ({
        ...m,
        isLoaded: false,
      }))
    );
    setLoadedModelId(null);
  }, [loadedModelId]);

  const deleteModel = useCallback(async (modelId: string) => {
    if (loadedModelId === modelId) {
      await unloadModel();
    }

    const success = await modelDownloadService.deleteModel(modelId);
    if (success) {
      setModels((prev) =>
        prev.map((m) =>
          m.id === modelId ? { ...m, isDownloaded: false, downloadProgress: 0 } : m
        )
      );
      await updateDiskSpace();
    }
    return success;
  }, [loadedModelId, unloadModel, updateDiskSpace]);

  const loadModel = useCallback(async (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (!model) {
      console.error('[ModelManager] Model not found:', modelId);
      return false;
    }

    if (!model.isDownloaded) {
      console.error('[ModelManager] Model not downloaded:', modelId);
      return false;
    }

    if (loadedModelId === modelId) {
      console.log('[ModelManager] Model already loaded:', modelId);
      return true;
    }

    if (loadedModelId) {
      await unloadModel();
    }

    setIsLoading(true);

    try {
      console.log('[ModelManager] Compiling model:', modelId);
      const compiled = await modelDownloadService.compileModel(modelId);
      
      if (!compiled) {
        console.error('[ModelManager] Model compilation failed:', modelId);
        return false;
      }

      console.log('[ModelManager] Initializing CoreML with model:', model.id);
      const success = await localModelManager.initialize({
        modelName: model.id,
        enableEncryption: settings.enableEncryption,
        maxBatchSize: settings.maxBatchSize,
        computeUnits: settings.computeUnits,
      });

      if (success) {
        setLoadedModelId(modelId);
        setModels((prev) =>
          prev.map((m) => ({
            ...m,
            isLoaded: m.id === modelId,
          }))
        );

        const newSettings = { ...settings, selectedModelId: modelId };
        await saveSettings(newSettings);

        console.log('[ModelManager] ✓ Model loaded successfully:', modelId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[ModelManager] Failed to load model:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [models, loadedModelId, settings, unloadModel, saveSettings]);

  const updateSettings = useCallback(async (updates: Partial<ModelSettings>) => {
    const newSettings = { ...settings, ...updates };
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  const getModel = useCallback((modelId: string) => {
    return models.find((m) => m.id === modelId);
  }, [models]);

  const getLoadedModel = useCallback(() => {
    if (!loadedModelId) return null;
    return models.find((m) => m.id === loadedModelId);
  }, [models, loadedModelId]);

  const isModelLoaded = useCallback((modelId: string) => {
    return loadedModelId === modelId;
  }, [loadedModelId]);

  const canDownload = useCallback((modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (!model) return false;
    return diskSpaceAvailable > model.size;
  }, [models, diskSpaceAvailable]);

  return {
    models,
    settings,
    loadedModelId,
    downloadProgress,
    isLoading,
    diskSpaceAvailable,
    downloadModel,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteModel,
    loadModel,
    unloadModel,
    updateSettings,
    getModel,
    getLoadedModel,
    isModelLoaded,
    canDownload,
    refreshModels: checkDownloadedModels,
    refreshDiskSpace: updateDiskSpace,
  };
});
