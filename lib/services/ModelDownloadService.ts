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
  
  private async fetchHuggingFaceRepoFiles(repoId: string, token?: string): Promise<HuggingFaceFile[]> {
    console.log('[ModelDownloadService] Fetching repository structure:', repoId);
    
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const apiUrl = `https://huggingface.co/api/models/${repoId}/tree/main`;
      console.log('[ModelDownloadService] API URL:', apiUrl);
      
      const response = await fetch(apiUrl, { headers });
      
      if (!response.ok) {
        console.warn('[ModelDownloadService] API request failed:', response.status, response.statusText);
        return this.fetchHuggingFaceRepoFilesAlternative(repoId);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('[ModelDownloadService] Non-JSON response, using alternative method');
        return this.fetchHuggingFaceRepoFilesAlternative(repoId);
      }
      
      const responseText = await response.text();
      let files;
      
      try {
        files = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[ModelDownloadService] JSON parse error:', parseError);
        console.error('[ModelDownloadService] Response preview:', responseText.substring(0, 200));
        return this.fetchHuggingFaceRepoFilesAlternative(repoId);
      }
      
      if (!Array.isArray(files)) {
        console.warn('[ModelDownloadService] Unexpected API response, using alternative');
        return this.fetchHuggingFaceRepoFilesAlternative(repoId);
      }
      
      const coreMLFiles = files
        .filter((f: any) => f.type === 'file' && f.path)
        .map((f: any) => ({
          path: f.path,
          size: f.size || 0,
          lfs: f.lfs,
        }));
      
      console.log(`[ModelDownloadService] Found ${coreMLFiles.length} files`);
      return coreMLFiles;
    } catch (error) {
      console.error('[ModelDownloadService] Failed to fetch repo files:', error);
      return this.fetchHuggingFaceRepoFilesAlternative(repoId);
    }
  }

  private async fetchHuggingFaceRepoFilesAlternative(repoId: string): Promise<HuggingFaceFile[]> {
    try {
      console.log('[ModelDownloadService] Using direct file structure for:', repoId);
      
      const testUrl = `https://huggingface.co/${repoId}/resolve/main/model.mlpackage/Manifest.json`;
      console.log('[ModelDownloadService] Testing repository access...');
      
      try {
        const testResponse = await fetch(testUrl, { method: 'HEAD' });
        if (testResponse.ok) {
          console.log('[ModelDownloadService] Repository is accessible, using standard CoreML structure');
          
          const knownStructure: HuggingFaceFile[] = [
            {
              path: 'model.mlpackage/Manifest.json',
              size: 0,
            },
            {
              path: 'model.mlpackage/Data/com.apple.CoreML/model.mlmodel',
              size: 0,
            },
            {
              path: 'model.mlpackage/Data/com.apple.CoreML/weights/weight.bin',
              size: 0,
            },
          ];
          
          return knownStructure;
        }
      } catch {
        console.warn('[ModelDownloadService] HEAD request failed, trying direct structure');
      }
      
      console.log('[ModelDownloadService] Using minimal CoreML structure');
      const minimalStructure: HuggingFaceFile[] = [
        {
          path: 'model.mlpackage/Manifest.json',
          size: 0,
        },
        {
          path: 'model.mlpackage/Data/com.apple.CoreML/model.mlmodel',
          size: 0,
        },
        {
          path: 'model.mlpackage/Data/com.apple.CoreML/weights/weight.bin',
          size: 0,
        },
      ];
      
      return minimalStructure;
    } catch (error) {
      console.error('[ModelDownloadService] Alternative method failed:', error);
      throw new Error('Failed to access repository. Please check the repository URL and try again.');
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
      console.log('[ModelDownloadService] Downloading:', url);
      console.log('[ModelDownloadService] To:', localPath);
      
      const callback = (downloadProgress: FileSystem.DownloadProgressData) => {
        if (onProgress) {
          onProgress(downloadProgress.totalBytesWritten);
        }
      };
      
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        localPath,
        {
          headers: {
            'Accept': '*/*',
          },
        },
        callback
      );
      
      const result = await downloadResumable.downloadAsync();
      
      if (result) {
        console.log('[ModelDownloadService] Successfully downloaded:', filePath);
        return true;
      } else {
        console.error('[ModelDownloadService] Download returned null for:', filePath);
        return false;
      }
    } catch (error) {
      console.error('[ModelDownloadService] Failed to download file:', filePath);
      if (error instanceof Error) {
        console.error('[ModelDownloadService] Error message:', error.message);
      }
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
    
    console.log(`[ModelDownloadService] Starting download: ${model.name}`);
    console.log(`[ModelDownloadService] Size: ${this.formatBytes(model.size)}`);
    
    try {
      await this.ensureModelDirectory();
      
      const isAlreadyDownloaded = await this.isModelDownloaded(model.id);
      if (isAlreadyDownloaded) {
        console.log('[ModelDownloadService] Model already downloaded');
        if (onProgress) {
          onProgress({
            modelId: model.id,
            bytesDownloaded: model.size,
            totalBytes: model.size,
            percentage: 100,
            speed: 0,
            estimatedTimeRemaining: 0,
            status: 'completed',
          });
        }
        return true;
      }
      
      const availableSpace = await this.getDiskSpaceAvailable();
      if (availableSpace < model.size * 1.5) {
        console.error('[ModelDownloadService] Insufficient disk space');
        console.error(`[ModelDownloadService] Required: ${this.formatBytes(model.size * 1.5)}, Available: ${this.formatBytes(availableSpace)}`);
        return false;
      }
      
      if (!model.huggingFaceRepo) {
        console.error('[ModelDownloadService] No Hugging Face repository specified');
        return false;
      }
      
      const files = await this.fetchHuggingFaceRepoFiles(model.huggingFaceRepo);
      
      if (files.length === 0) {
        console.error('[ModelDownloadService] No files found in repository');
        return false;
      }
      
      const modelPath = this.getModelPath(model.id);
      const tempDir = `${this.getModelDirectory()}temp_${model.id}/`;
      
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
      
      const startTime = Date.now();
      let totalBytesDownloaded = 0;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const localFilePath = `${tempDir}${file.path}`;
        const localFileDir = localFilePath.substring(0, localFilePath.lastIndexOf('/'));
        
        await FileSystem.makeDirectoryAsync(localFileDir, { intermediates: true });
        
        const success = await this.downloadHuggingFaceFile(
          model.huggingFaceRepo!,
          file.path,
          localFilePath,
          (bytes) => {
            totalBytesDownloaded += bytes;
            if (onProgress) {
              onProgress(
                this.calculateProgress(
                  {
                    totalBytesWritten: totalBytesDownloaded,
                    totalBytesExpectedToWrite: model.size,
                  },
                  model.id,
                  startTime
                )
              );
            }
          }
        );
        
        if (!success) {
          console.error(`[ModelDownloadService] Failed to download file: ${file.path}`);
          await FileSystem.deleteAsync(tempDir, { idempotent: true });
          return false;
        }
        
        console.log(`[ModelDownloadService] Progress: ${i + 1}/${files.length} files`);
      }
      
      const mlpackagePath = `${tempDir}model.mlpackage`;
      const mlpackageExists = await FileSystem.getInfoAsync(mlpackagePath);
      
      if (mlpackageExists.exists) {
        await FileSystem.moveAsync({
          from: mlpackagePath,
          to: modelPath,
        });
      } else {
        await FileSystem.moveAsync({
          from: tempDir,
          to: modelPath,
        });
      }
      
      await FileSystem.deleteAsync(tempDir, { idempotent: true });
      
      const verified = await this.verifyDownload(model.id, modelPath);
      
      if (verified) {
        console.log(`[ModelDownloadService] ✓ Download complete: ${model.name}`);
        if (onProgress) {
          onProgress({
            modelId: model.id,
            bytesDownloaded: model.size,
            totalBytes: model.size,
            percentage: 100,
            speed: 0,
            estimatedTimeRemaining: 0,
            status: 'completed',
          });
        }
        return true;
      } else {
        console.error('[ModelDownloadService] Verification failed');
        await FileSystem.deleteAsync(modelPath, { idempotent: true });
        return false;
      }
    } catch (error) {
      console.error('[ModelDownloadService] Download failed:', error);
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
