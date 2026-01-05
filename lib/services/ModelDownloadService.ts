import * as FileSystem from 'expo-file-system/legacy';
import { Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { DownloadProgress, LLMModel } from '@/types/model-manager';

interface HuggingFaceFile {
  path: string;
  size: number;
  lfs?: {
    oid: string;
    size: number;
    pointerSize: number;
  };
}

export class ModelDownloadService {
  private static instance: ModelDownloadService;
  private downloads: Map<string, FileSystem.DownloadResumable> = new Map();
  private progressCallbacks: Map<string, (progress: DownloadProgress) => void> = new Map();
  
  private constructor() {
    console.log('[ModelDownloadService] Initialized');
  }
  
  static getInstance(): ModelDownloadService {
    if (!ModelDownloadService.instance) {
      ModelDownloadService.instance = new ModelDownloadService();
    }
    return ModelDownloadService.instance;
  }
  
  getModelDirectory(): string {
    if (Platform.OS === 'web') {
      return '';
    }
    return `${Paths.document.uri}models/`;
  }
  
  getModelPath(modelId: string): string {
    return `${this.getModelDirectory()}${modelId}.mlpackage`;
  }
  
  getTempDownloadPath(modelId: string): string {
    return `${this.getModelDirectory()}${modelId}.zip`;
  }
  
  async ensureModelDirectory(): Promise<void> {
    if (Platform.OS === 'web') return;
    
    const dir = this.getModelDirectory();
    const dirInfo = await FileSystem.getInfoAsync(dir);
    
    if (!dirInfo.exists) {
      console.log('[ModelDownloadService] Creating models directory');
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }
  
  async isModelDownloaded(modelId: string): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    
    const path = this.getModelPath(modelId);
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  }
  
  private async fetchHuggingFaceRepoFiles(repoId: string): Promise<HuggingFaceFile[]> {
    try {
      console.log('[ModelDownloadService] Fetching repo structure for:', repoId);
      
      const modelInfoUrl = `https://huggingface.co/api/models/${repoId}`;
      console.log('[ModelDownloadService] Fetching model info from:', modelInfoUrl);
      
      const infoResponse = await fetch(modelInfoUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!infoResponse.ok) {
        console.error('[ModelDownloadService] Model info API response:', infoResponse.status);
        throw new Error(`Failed to fetch model info: ${infoResponse.status}`);
      }
      
      const modelInfo = await infoResponse.json();
      console.log('[ModelDownloadService] Model info received');
      
      if (!modelInfo.siblings || !Array.isArray(modelInfo.siblings)) {
        console.error('[ModelDownloadService] No siblings field in response');
        return [];
      }
      
      const allFiles: HuggingFaceFile[] = modelInfo.siblings
        .filter((file: any) => file.rfilename)
        .map((file: any) => ({
          path: file.rfilename,
          size: file.size || 0,
          lfs: file.lfs ? {
            oid: file.lfs.oid,
            size: file.lfs.size || file.size,
            pointerSize: file.lfs.pointerSize || 0,
          } : undefined,
        }));
      
      console.log(`[ModelDownloadService] Total files in repo: ${allFiles.length}`);
      console.log('[ModelDownloadService] Sample files:', allFiles.slice(0, 5).map(f => f.path));
      
      const mlpackageFiles = allFiles.filter(f => 
        f.path && f.path.includes('.mlpackage')
      );
      
      console.log(`[ModelDownloadService] Found ${mlpackageFiles.length} mlpackage files`);
      
      if (mlpackageFiles.length === 0) {
        console.warn('[ModelDownloadService] No .mlpackage files found. Looking for any model files...');
        const modelFiles = allFiles.filter(f => 
          f.path && (f.path.endsWith('.bin') || f.path.endsWith('.mlmodel') || f.path.endsWith('.safetensors') || f.path.endsWith('.mlmodelc'))
        );
        console.log(`[ModelDownloadService] Found ${modelFiles.length} alternative model files`);
        return modelFiles;
      }
      
      return mlpackageFiles;
    } catch (error) {
      console.error('[ModelDownloadService] Failed to fetch repo files:', error);
      if (error instanceof Error) {
        console.error('[ModelDownloadService] Error details:', error.message);
      }
      throw error;
    }
  }

  private async downloadHuggingFaceFile(
    repoId: string,
    filePath: string,
    localPath: string,
    onProgress?: (bytes: number) => void
  ): Promise<boolean> {
    try {
      const url = `https://huggingface.co/${repoId}/resolve/main/${filePath}`;
      console.log('[ModelDownloadService] Downloading file:', filePath);
      
      const callback = (downloadProgress: FileSystem.DownloadProgressData) => {
        if (onProgress) {
          onProgress(downloadProgress.totalBytesWritten);
        }
      };
      
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        localPath,
        {},
        callback
      );
      
      const result = await downloadResumable.downloadAsync();
      return result !== null && result !== undefined;
    } catch (error) {
      console.error('[ModelDownloadService] Failed to download file:', filePath, error);
      return false;
    }
  }

  async downloadModel(
    model: LLMModel,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<boolean> {
    if (Platform.OS === 'web') {
      console.warn('[ModelDownloadService] Downloads not supported on web');
      return false;
    }
    
    if (!model.downloadUrl) {
      console.error('[ModelDownloadService] No download URL for model:', model.id);
      return false;
    }
    
    await this.ensureModelDirectory();
    
    const startTime = Date.now();
    
    try {
      console.log(`[ModelDownloadService] Starting download: ${model.displayName}`);
      
      if (model.downloadUrl.startsWith('hf://')) {
        const repoId = model.downloadUrl.replace('hf://', '');
        console.log('[ModelDownloadService] Downloading from Hugging Face:', repoId);
        
        const files = await this.fetchHuggingFaceRepoFiles(repoId);
        
        if (files.length === 0) {
          console.error('[ModelDownloadService] No files found in repository');
          throw new Error('No model files found in repository');
        }
        
        const totalBytes = files.reduce((sum, f) => sum + (f.lfs?.size || f.size || 0), 0);
        let downloadedBytes = 0;
        
        const modelDir = this.getModelPath(model.id);
        await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });
        
        console.log(`[ModelDownloadService] Downloading ${files.length} files...`);
        
        for (const file of files) {
          const relativePath = file.path.replace('model.mlpackage/', '');
          const localPath = `${modelDir}/${relativePath}`;
          
          const localDir = localPath.substring(0, localPath.lastIndexOf('/'));
          await FileSystem.makeDirectoryAsync(localDir, { intermediates: true });
          
          const success = await this.downloadHuggingFaceFile(
            repoId,
            file.path,
            localPath,
            (bytes) => {
              const currentTotal = downloadedBytes + bytes;
              const percentage = (currentTotal / totalBytes) * 100;
              const elapsedTime = (Date.now() - startTime) / 1000;
              const speed = elapsedTime > 0 ? currentTotal / elapsedTime : 0;
              const remainingBytes = totalBytes - currentTotal;
              const estimatedTimeRemaining = speed > 0 ? remainingBytes / speed : 0;
              
              if (onProgress) {
                onProgress({
                  modelId: model.id,
                  bytesDownloaded: currentTotal,
                  totalBytes,
                  percentage,
                  speed,
                  estimatedTimeRemaining,
                  status: 'downloading',
                });
              }
            }
          );
          
          if (!success) {
            throw new Error(`Failed to download file: ${file.path}`);
          }
          
          downloadedBytes += (file.lfs?.size || file.size || 0);
        }
        
        console.log(`[ModelDownloadService] All files downloaded successfully`);
        
        if (onProgress) {
          onProgress({
            modelId: model.id,
            bytesDownloaded: totalBytes,
            totalBytes,
            percentage: 100,
            speed: 0,
            estimatedTimeRemaining: 0,
            status: 'completed',
          });
        }
        
        await this.verifyDownload(model.id, modelDir);
        return true;
      } else {
        const isZipFile = model.downloadUrl.endsWith('.zip');
        const downloadPath = isZipFile ? this.getTempDownloadPath(model.id) : this.getModelPath(model.id);
        
        const callback = (downloadProgress: FileSystem.DownloadProgressData) => {
          const progress = this.calculateProgress(
            downloadProgress,
            model.id,
            startTime
          );
          
          if (onProgress) {
            onProgress(progress);
          }
          
          const callback = this.progressCallbacks.get(model.id);
          if (callback) {
            callback(progress);
          }
        };
        
        const downloadResumable = FileSystem.createDownloadResumable(
          model.downloadUrl,
          downloadPath,
          {},
          callback
        );
        
        this.downloads.set(model.id, downloadResumable);
        
        const result = await downloadResumable.downloadAsync();
        
        if (result) {
          console.log(`[ModelDownloadService] Download completed: ${model.displayName}`);
          
          if (isZipFile) {
            console.log(`[ModelDownloadService] Note: Downloaded as ZIP. Manual extraction required.`);
            await FileSystem.moveAsync({
              from: result.uri,
              to: this.getModelPath(model.id)
            });
          }
          
          await this.verifyDownload(model.id, this.getModelPath(model.id));
          this.downloads.delete(model.id);
          return true;
        }
        
        return false;
      }
    } catch (error) {
      console.error('[ModelDownloadService] Download failed:', error);
      this.downloads.delete(model.id);
      
      if (onProgress) {
        onProgress({
          modelId: model.id,
          bytesDownloaded: 0,
          totalBytes: model.size,
          percentage: 0,
          speed: 0,
          estimatedTimeRemaining: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Download failed',
        });
      }
      
      return false;
    }
  }
  
  async pauseDownload(modelId: string): Promise<void> {
    const download = this.downloads.get(modelId);
    if (download) {
      try {
        await download.pauseAsync();
        console.log(`[ModelDownloadService] Paused download: ${modelId}`);
      } catch (error) {
        console.error('[ModelDownloadService] Failed to pause download:', error);
      }
    }
  }
  
  async resumeDownload(modelId: string): Promise<void> {
    const download = this.downloads.get(modelId);
    if (download) {
      try {
        await download.resumeAsync();
        console.log(`[ModelDownloadService] Resumed download: ${modelId}`);
      } catch (error) {
        console.error('[ModelDownloadService] Failed to resume download:', error);
      }
    }
  }
  
  async cancelDownload(modelId: string): Promise<void> {
    const download = this.downloads.get(modelId);
    if (download) {
      try {
        await download.pauseAsync();
        this.downloads.delete(modelId);
        
        const path = this.getModelPath(modelId);
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          await FileSystem.deleteAsync(path);
        }
        
        console.log(`[ModelDownloadService] Cancelled download: ${modelId}`);
      } catch (error) {
        console.error('[ModelDownloadService] Failed to cancel download:', error);
      }
    }
  }
  
  async deleteModel(modelId: string): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    
    try {
      const path = this.getModelPath(modelId);
      const info = await FileSystem.getInfoAsync(path);
      
      if (info.exists) {
        await FileSystem.deleteAsync(path);
        console.log(`[ModelDownloadService] Deleted model: ${modelId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[ModelDownloadService] Failed to delete model:', error);
      return false;
    }
  }
  
  async getModelSize(modelId: string): Promise<number> {
    if (Platform.OS === 'web') return 0;
    
    try {
      const path = this.getModelPath(modelId);
      const info = await FileSystem.getInfoAsync(path);
      
      if (info.exists && 'size' in info) {
        return info.size || 0;
      }
      
      return 0;
    } catch (error) {
      console.error('[ModelDownloadService] Failed to get model size:', error);
      return 0;
    }
  }
  
  async getDiskSpaceAvailable(): Promise<number> {
    if (Platform.OS === 'web') return Infinity;
    
    try {
      const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
      return freeDiskStorage;
    } catch (error) {
      console.error('[ModelDownloadService] Failed to get disk space:', error);
      return 0;
    }
  }
  
  registerProgressCallback(
    modelId: string,
    callback: (progress: DownloadProgress) => void
  ): void {
    this.progressCallbacks.set(modelId, callback);
  }
  
  unregisterProgressCallback(modelId: string): void {
    this.progressCallbacks.delete(modelId);
  }
  
  private calculateProgress(
    downloadProgress: FileSystem.DownloadProgressData,
    modelId: string,
    startTime: number
  ): DownloadProgress {
    const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
    const percentage = totalBytesExpectedToWrite > 0
      ? (totalBytesWritten / totalBytesExpectedToWrite) * 100
      : 0;
    
    const elapsedTime = (Date.now() - startTime) / 1000;
    const speed = elapsedTime > 0 ? totalBytesWritten / elapsedTime : 0;
    
    const remainingBytes = totalBytesExpectedToWrite - totalBytesWritten;
    const estimatedTimeRemaining = speed > 0 ? remainingBytes / speed : 0;
    
    return {
      modelId,
      bytesDownloaded: totalBytesWritten,
      totalBytes: totalBytesExpectedToWrite,
      percentage,
      speed,
      estimatedTimeRemaining,
      status: percentage >= 100 ? 'completed' : 'downloading',
    };
  }
  
  private async verifyDownload(modelId: string, path: string): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(path);
      
      if (!info.exists) {
        console.error('[ModelDownloadService] Downloaded file not found');
        return false;
      }
      
      console.log(`[ModelDownloadService] Model verified: ${modelId}`);
      return true;
    } catch (error) {
      console.error('[ModelDownloadService] Verification failed:', error);
      return false;
    }
  }
  
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }
  
  formatSpeed(bytesPerSecond: number): string {
    return `${this.formatBytes(bytesPerSecond)}/s`;
  }
  
  formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }
  

  
  async getAvailableSpace(): Promise<{ available: number; total: number; formatted: string }> {
    if (Platform.OS === 'web') {
      return { available: Infinity, total: Infinity, formatted: 'Unlimited' };
    }
    
    try {
      const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
      const totalDiskCapacity = await FileSystem.getTotalDiskCapacityAsync();
      
      return {
        available: freeDiskStorage,
        total: totalDiskCapacity,
        formatted: `${this.formatBytes(freeDiskStorage)} / ${this.formatBytes(totalDiskCapacity)}`,
      };
    } catch (error) {
      console.error('[ModelDownloadService] Failed to get disk space:', error);
      return { available: 0, total: 0, formatted: 'Unknown' };
    }
  }
  
  async listDownloadedModels(): Promise<string[]> {
    if (Platform.OS === 'web') return [];
    
    try {
      await this.ensureModelDirectory();
      const files = await FileSystem.readDirectoryAsync(this.getModelDirectory());
      return files.filter(f => f.endsWith('.mlpackage'));
    } catch (error) {
      console.error('[ModelDownloadService] Failed to list models:', error);
      return [];
    }
  }
}

export const modelDownloadService = ModelDownloadService.getInstance();
export default modelDownloadService;
