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
      const apiUrl = `https://huggingface.co/api/models/${repoId}/tree/main`;
      console.log('[ModelDownloadService] Fetching from HF API:', apiUrl);
      
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        console.log('[ModelDownloadService] API fetch failed, using fallback discovery');
        return this.fetchHuggingFaceRepoFilesAlternative(repoId);
      }
      
      const data = await response.json();
      console.log('[ModelDownloadService] Received file tree with', data.length, 'items');
      
      const mlpackageFiles = data
        .filter((item: any) => 
          item.type === 'file' && 
          (item.path.includes('.mlpackage') || 
           item.path.endsWith('.mlmodel') ||
           item.path.endsWith('.bin') ||
           item.path.endsWith('Manifest.json'))
        )
        .map((item: any) => ({
          path: item.path,
          size: item.size || 0,
          lfs: item.lfs ? {
            oid: item.lfs.oid,
            size: item.lfs.size,
            pointerSize: item.lfs.pointerSize,
          } : undefined,
        }));
      
      if (mlpackageFiles.length > 0) {
        console.log('[ModelDownloadService] Found', mlpackageFiles.length, 'mlpackage files');
        return mlpackageFiles;
      }
      
      console.log('[ModelDownloadService] No mlpackage files found, using fallback');
      return this.fetchHuggingFaceRepoFilesAlternative(repoId);
    } catch (error) {
      console.error('[ModelDownloadService] API fetch error:', error);
      return this.fetchHuggingFaceRepoFilesAlternative(repoId);
    }
  }

  private async fetchHuggingFaceRepoFilesAlternative(repoId: string): Promise<HuggingFaceFile[]> {
    console.log('[ModelDownloadService] Using direct file discovery for:', repoId);
    
    const possibleStructures = [
      [
        'model.mlpackage/Manifest.json',
        'model.mlpackage/Data/com.apple.CoreML/model.mlmodel',
        'model.mlpackage/Data/com.apple.CoreML/weights/weight.bin',
      ],
      [
        'coreml/model.mlpackage/Manifest.json',
        'coreml/model.mlpackage/Data/com.apple.CoreML/model.mlmodel',
        'coreml/model.mlpackage/Data/com.apple.CoreML/weights/weight.bin',
      ],
      [
        'mlpackage/Manifest.json',
        'mlpackage/Data/com.apple.CoreML/model.mlmodel',
        'mlpackage/Data/com.apple.CoreML/weights/weight.bin',
      ],
    ];
    
    for (const structure of possibleStructures) {
      const testUrl = `https://huggingface.co/${repoId}/resolve/main/${structure[0]}`;
      console.log('[ModelDownloadService] Testing structure:', structure[0]);
      
      try {
        const testResponse = await fetch(testUrl, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });
        
        if (testResponse.ok) {
          console.log('[ModelDownloadService] Found valid structure, fetching sizes...');
          
          const filesWithSizes = await Promise.all(
            structure.map(async (path) => {
              try {
                const fileUrl = `https://huggingface.co/${repoId}/resolve/main/${path}`;
                const headResponse = await fetch(fileUrl, { 
                  method: 'HEAD',
                  signal: AbortSignal.timeout(5000)
                });
                
                const size = headResponse.headers.get('content-length');
                console.log(`[ModelDownloadService] ${path}: ${size || 'unknown'} bytes`);
                
                return {
                  path,
                  size: size ? parseInt(size, 10) : 0,
                };
              } catch {
                return {
                  path,
                  size: 0,
                };
              }
            })
          );
          
          return filesWithSizes;
        }
      } catch {
        console.log('[ModelDownloadService] Structure not found, trying next...');
        continue;
      }
    }
    
    throw new Error(`Could not find valid model structure for ${repoId}. Please verify the repository contains a CoreML model.`);
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
      
      const manifestPath = `${path}/Manifest.json`;
      const manifestInfo = await FileSystem.getInfoAsync(manifestPath);
      
      if (!manifestInfo.exists) {
        console.warn('[ModelDownloadService] Manifest.json not found in model package');
      }
      
      const modelPath = `${path}/Data/com.apple.CoreML/model.mlmodel`;
      const modelInfo = await FileSystem.getInfoAsync(modelPath);
      
      if (!modelInfo.exists) {
        console.error('[ModelDownloadService] model.mlmodel not found in package');
        return false;
      }
      
      console.log(`[ModelDownloadService] Model verified: ${modelId}`);
      console.log(`[ModelDownloadService] Manifest exists: ${manifestInfo.exists}`);
      console.log(`[ModelDownloadService] Model exists: ${modelInfo.exists}`);
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

  async compileModel(modelId: string): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      console.warn('[ModelDownloadService] Model compilation only supported on iOS');
      return true;
    }

    try {
      const modelPath = this.getModelPath(modelId);
      const info = await FileSystem.getInfoAsync(modelPath);

      if (!info.exists) {
        console.error('[ModelDownloadService] Model not found for compilation');
        return false;
      }

      const manifestPath = `${modelPath}/Manifest.json`;
      const modelMLPath = `${modelPath}/Data/com.apple.CoreML/model.mlmodel`;
      
      const manifestExists = await FileSystem.getInfoAsync(manifestPath);
      const modelMLExists = await FileSystem.getInfoAsync(modelMLPath);

      if (!manifestExists.exists || !modelMLExists.exists) {
        console.error('[ModelDownloadService] Invalid model package structure');
        return false;
      }

      console.log('[ModelDownloadService] Model package ready for CoreML:', modelPath);
      console.log('[ModelDownloadService] Structure verified: Manifest + model.mlmodel present');
      return true;
    } catch (error) {
      console.error('[ModelDownloadService] Model compilation failed:', error);
      return false;
    }
  }

  getCompiledModelPath(modelId: string): string {
    return this.getModelPath(modelId);
  }
}

export const modelDownloadService = ModelDownloadService.getInstance();
export default modelDownloadService;
