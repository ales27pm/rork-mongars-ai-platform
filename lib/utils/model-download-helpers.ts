import React from 'react';
import { modelDownloadService } from '@/lib/services/ModelDownloadService';
import { LLMModel, DownloadProgress, AVAILABLE_MODELS } from '@/types/model-manager';
import { Platform } from 'react-native';

export interface ModelDownloadState {
  isDownloading: boolean;
  progress: number;
  speed: number;
  eta: number;
  error?: string;
}

export class ModelDownloadHelper {
  private static progressCallbacks = new Map<string, (progress: DownloadProgress) => void>();

  static async checkModelAvailability(modelId: string): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }
    return await modelDownloadService.isModelDownloaded(modelId);
  }

  static async checkDiskSpace(requiredBytes: number): Promise<{
    hasSpace: boolean;
    available: number;
    required: number;
    formatted: string;
  }> {
    const space = await modelDownloadService.getAvailableSpace();
    const hasSpace = space.available >= requiredBytes * 1.5;
    
    return {
      hasSpace,
      available: space.available,
      required: requiredBytes * 1.5,
      formatted: space.formatted,
    };
  }

  static formatBytes(bytes: number): string {
    return modelDownloadService.formatBytes(bytes);
  }

  static formatSpeed(bytesPerSecond: number): string {
    return modelDownloadService.formatSpeed(bytesPerSecond);
  }

  static formatETA(seconds: number): string {
    return modelDownloadService.formatTime(seconds);
  }

  static async startDownload(
    model: LLMModel,
    onProgress: (state: ModelDownloadState) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ): Promise<void> {
    const progressCallback = (progress: DownloadProgress) => {
      onProgress({
        isDownloading: progress.status === 'downloading',
        progress: progress.percentage,
        speed: progress.speed,
        eta: progress.estimatedTimeRemaining,
        error: progress.error,
      });

      if (progress.status === 'completed') {
        this.progressCallbacks.delete(model.id);
        onComplete();
      } else if (progress.status === 'error') {
        this.progressCallbacks.delete(model.id);
        onError(progress.error || 'Download failed');
      }
    };

    this.progressCallbacks.set(model.id, progressCallback);
    modelDownloadService.registerProgressCallback(model.id, progressCallback);

    try {
      const success = await modelDownloadService.downloadModel(model, progressCallback);
      if (!success) {
        throw new Error('Download failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onError(errorMessage);
      this.progressCallbacks.delete(model.id);
    }
  }

  static async cancelDownload(modelId: string): Promise<void> {
    await modelDownloadService.cancelDownload(modelId);
    this.progressCallbacks.delete(modelId);
    modelDownloadService.unregisterProgressCallback(modelId);
  }

  static async deleteModel(modelId: string): Promise<boolean> {
    return await modelDownloadService.deleteModel(modelId);
  }

  static async getDownloadedModels(): Promise<string[]> {
    return await modelDownloadService.listDownloadedModels();
  }

  static async getModelSize(modelId: string): Promise<number> {
    return await modelDownloadService.getModelSize(modelId);
  }

  static async validateModelBeforeDownload(model: LLMModel): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (!model.huggingFaceRepo && !model.downloadUrl) {
      errors.push('No download source specified');
    }

    if (model.size <= 0) {
      errors.push('Invalid model size');
    }

    const spaceCheck = await this.checkDiskSpace(model.size);
    if (!spaceCheck.hasSpace) {
      errors.push(
        `Insufficient disk space. Required: ${this.formatBytes(spaceCheck.required)}, Available: ${this.formatBytes(spaceCheck.available)}`
      );
    }

    if (Platform.OS === 'web') {
      errors.push('Model downloads are not supported on web');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static getRecommendedModel(availableSpace: number): LLMModel | null {
    const sortedModels = [...AVAILABLE_MODELS].sort((a, b) => a.size - b.size);
    
    for (const model of sortedModels) {
      if (model.size * 1.5 < availableSpace) {
        return model;
      }
    }
    
    return null;
  }

  static estimateDownloadTime(modelSize: number, speedBytesPerSecond: number): string {
    if (speedBytesPerSecond <= 0) {
      return 'Calculating...';
    }
    
    const seconds = modelSize / speedBytesPerSecond;
    return this.formatETA(seconds);
  }

  static async verifyModelIntegrity(modelId: string): Promise<boolean> {
    const isDownloaded = await this.checkModelAvailability(modelId);
    if (!isDownloaded) {
      return false;
    }

    const size = await this.getModelSize(modelId);
    return size > 0;
  }

  static getModelDownloadURL(model: LLMModel): string | null {
    if (model.huggingFaceRepo) {
      return `https://huggingface.co/${model.huggingFaceRepo}`;
    }
    
    if (model.downloadUrl) {
      return model.downloadUrl.replace('hf://', 'https://huggingface.co/');
    }
    
    return null;
  }

  static cleanup(): void {
    for (const [modelId] of this.progressCallbacks) {
      modelDownloadService.unregisterProgressCallback(modelId);
    }
    this.progressCallbacks.clear();
  }
}

export function useModelDownloadState(model: LLMModel) {
  const [state, setState] = React.useState<ModelDownloadState>({
    isDownloading: false,
    progress: 0,
    speed: 0,
    eta: 0,
  });

  const [isAvailable, setIsAvailable] = React.useState(false);

  React.useEffect(() => {
    ModelDownloadHelper.checkModelAvailability(model.id).then(setIsAvailable);
  }, [model.id]);

  const startDownload = React.useCallback(() => {
    return ModelDownloadHelper.startDownload(
      model,
      setState,
      () => {
        setIsAvailable(true);
        setState({ isDownloading: false, progress: 100, speed: 0, eta: 0 });
      },
      (error) => {
        setState(prev => ({ ...prev, isDownloading: false, error }));
      }
    );
  }, [model]);

  const cancelDownload = React.useCallback(() => {
    return ModelDownloadHelper.cancelDownload(model.id);
  }, [model.id]);

  const deleteModel = React.useCallback(async () => {
    const success = await ModelDownloadHelper.deleteModel(model.id);
    if (success) {
      setIsAvailable(false);
    }
    return success;
  }, [model.id]);

  return {
    state,
    isAvailable,
    startDownload,
    cancelDownload,
    deleteModel,
  };
}
