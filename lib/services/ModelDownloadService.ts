import * as FileSystem from "expo-file-system/legacy";
import { Paths } from "expo-file-system";
import { Platform } from "react-native";
import {
  AVAILABLE_MODELS,
  DownloadProgress,
  LLMModel,
} from "@/types/model-manager";
import {
  HuggingFaceFile,
  ModelDownloadFormat,
  resolveModelRoot,
} from "@/lib/services/model-download-utils";
import { hfUrl, listRepoFiles } from "@/lib/services/huggingface-client";

export class ModelDownloadService {
  private static instance: ModelDownloadService;
  private downloads: Map<string, FileSystem.DownloadResumable> = new Map();
  private progressCallbacks: Map<string, (progress: DownloadProgress) => void> =
    new Map();

  private constructor() {
    console.log("[ModelDownloadService] Initialized");
  }

  static getInstance(): ModelDownloadService {
    if (!ModelDownloadService.instance) {
      ModelDownloadService.instance = new ModelDownloadService();
    }
    return ModelDownloadService.instance;
  }

  getModelDirectory(): string {
    if (Platform.OS === "web") {
      return "";
    }
    return `${Paths.document.uri}models/`;
  }

  private getModelFormat(modelId: string): ModelDownloadFormat {
    const knownModel = AVAILABLE_MODELS.find((model) => model.id === modelId);
    return knownModel?.format ?? "coreml";
  }

  getModelPath(modelId: string, format?: ModelDownloadFormat): string {
    const resolvedFormat = format ?? this.getModelFormat(modelId);
    const extension = resolvedFormat === "mlx" ? "mlx" : "mlpackage";
    return `${this.getModelDirectory()}${modelId}.${extension}`;
  }

  getTempDownloadPath(modelId: string): string {
    return `${this.getModelDirectory()}${modelId}.zip`;
  }

  async ensureModelDirectory(): Promise<void> {
    if (Platform.OS === "web") return;

    const dir = this.getModelDirectory();
    const dirInfo = await FileSystem.getInfoAsync(dir);

    if (!dirInfo.exists) {
      console.log("[ModelDownloadService] Creating models directory");
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }

  async isModelDownloaded(modelId: string): Promise<boolean> {
    if (Platform.OS === "web") return false;

    const path = this.getModelPath(modelId);
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  }

  private async fetchHuggingFaceRepoFiles(
    repoId: string,
    format: ModelDownloadFormat,
    token?: string,
    subpath?: string,
  ): Promise<HuggingFaceFile[]> {
    console.log(
      "[ModelDownloadService] Fetching repository structure:",
      repoId,
    );
    if (subpath) {
      console.log("[ModelDownloadService] Filtering by subpath:", subpath);
    }

    try {
      const repoFiles = await listRepoFiles({
        repo: repoId,
        revision: "main",
        accessToken: token,
      });

      let filteredFiles = repoFiles;
      
      if (subpath) {
        const subpathPrefix = subpath.endsWith('/') ? subpath : `${subpath}/`;
        filteredFiles = repoFiles.filter((path) => path.startsWith(subpathPrefix));
        console.log(`[ModelDownloadService] Found ${filteredFiles.length} files in subpath ${subpath}`);
      }

      const files = filteredFiles
        .filter((path) =>
          format === "mlx" ? this.isMLXFile(path) : this.isCoreMLFile(path),
        )
        .map((path) => ({ path }));

      if (files.length === 0) {
        throw new Error(`No ${format} files found in ${repoId}.`);
      }

      const sizedFiles = await Promise.all(
        files.map(async (file) => {
          const size = await this.fetchHuggingFaceFileSize(
            repoId,
            file.path,
            token,
          );
          return { ...file, size };
        }),
      );

      console.log(
        "[ModelDownloadService] Found",
        sizedFiles.length,
        format === "mlx" ? "MLX files" : "CoreML files",
      );
      sizedFiles.forEach((file) =>
        console.log(`  - ${file.path} (${this.formatBytes(file.size)})`),
      );

      return sizedFiles;
    } catch (error) {
      console.error("[ModelDownloadService] Hugging Face fetch error:", error);
      if (error instanceof Error) {
        console.error("[ModelDownloadService] Error details:", error.message);
      }
      throw error;
    }
  }

  private isMLXFile(path: string): boolean {
    const mlxFilePatterns = [
      /\.safetensors$/,
      /\.safetensors\.index\.json$/,
      /config\.json$/,
      /tokenizer\.json$/,
      /tokenizer\.model$/,
      /tokenizer_config\.json$/,
      /generation_config\.json$/,
      /special_tokens_map\.json$/,
      /vocab\.json$/,
      /merges\.txt$/,
      /added_tokens\.json$/,
      /model\.safetensors\.index\.json$/,
    ];
    return mlxFilePatterns.some((pattern) => pattern.test(path));
  }

  private isCoreMLFile(path: string): boolean {
    // Must be a file INSIDE a .mlpackage directory, not the directory itself
    if (path.includes(".mlpackage/")) {
      return true;
    }
    if (path.endsWith(".mlmodel")) {
      return true;
    }
    return false;
  }

  private async fetchHuggingFaceFileSize(
    repoId: string,
    filePath: string,
    token?: string,
  ): Promise<number> {
    try {
      const url = hfUrl({
        repo: repoId,
        path: filePath,
        revision: "main",
      });
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(url, {
        method: "HEAD",
        headers,
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        return 0;
      }
      const size = response.headers.get("content-length");
      return size ? parseInt(size, 10) : 0;
    } catch (error) {
      console.warn(
        "[ModelDownloadService] Failed to resolve file size:",
        filePath,
        error instanceof Error ? error.message : "Unknown error",
      );
      return 0;
    }
  }

  private async downloadHuggingFaceFile(
    repoId: string,
    filePath: string,
    localPath: string,
    onProgress?: (bytes: number) => void,
  ): Promise<boolean> {
    try {
      const url = hfUrl({
        repo: repoId,
        path: filePath,
        revision: "main",
      });
      console.log("[ModelDownloadService] Downloading file:");
      console.log(`  URL: ${url}`);
      console.log(`  Destination: ${localPath}`);

      const headResponse = await fetch(url, {
        method: "HEAD",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MLX-Download/1.0)",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!headResponse.ok) {
        console.error(
          `[ModelDownloadService] File not accessible: ${filePath} (HTTP ${headResponse.status})`,
        );
        if (headResponse.status === 404) {
          console.error(
            `[ModelDownloadService] File does not exist in repo: ${repoId}/${filePath}`,
          );
        }
        return false;
      }

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
            Accept: "*/*",
            "User-Agent": "Mozilla/5.0 (compatible; MLX-Download/1.0)",
          },
        },
        callback,
      );

      const result = await downloadResumable.downloadAsync();

      if (result && result.status === 200) {
        const fileInfo = await FileSystem.getInfoAsync(localPath);
        if (fileInfo.exists && "size" in fileInfo) {
          console.log(
            `[ModelDownloadService] ✓ Downloaded ${filePath} (${this.formatBytes(fileInfo.size || 0)})`,
          );
          return true;
        } else {
          console.error(
            "[ModelDownloadService] Downloaded file not found:",
            filePath,
          );
          return false;
        }
      } else {
        console.error(
          "[ModelDownloadService] Download failed with status:",
          result?.status,
        );
        if (result?.status === 404) {
          console.error(
            `[ModelDownloadService] 404 Not Found - verify repo exists: https://huggingface.co/${repoId}`,
          );
        }
        return false;
      }
    } catch (error) {
      console.error(
        "[ModelDownloadService] Download error for file:",
        filePath,
      );
      if (error instanceof Error) {
        console.error("[ModelDownloadService] Error:", error.message);
        if (error.name === "AbortError" || error.message.includes("timeout")) {
          console.error("[ModelDownloadService] Request timed out - check network connection");
        }
      }
      return false;
    }
  }

  async downloadModel(
    model: LLMModel,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<boolean> {
    if (Platform.OS === "web") {
      console.warn("[ModelDownloadService] Downloads not supported on web");
      return false;
    }

    const modelFormat = model.format ?? "coreml";

    console.log(`[ModelDownloadService] Starting download: ${model.name}`);
    console.log(`[ModelDownloadService] Format: ${modelFormat}`);
    console.log(`[ModelDownloadService] Size: ${this.formatBytes(model.size)}`);

    let tempDir = "";

    try {
      await this.ensureModelDirectory();

      const isAlreadyDownloaded = await this.isModelDownloaded(model.id);
      if (isAlreadyDownloaded) {
        console.log("[ModelDownloadService] Model already downloaded");
        if (onProgress) {
          onProgress({
            modelId: model.id,
            bytesDownloaded: model.size,
            totalBytes: model.size,
            percentage: 100,
            speed: 0,
            estimatedTimeRemaining: 0,
            status: "completed",
          });
        }
        return true;
      }

      const availableSpace = await this.getDiskSpaceAvailable();
      if (availableSpace < model.size * 1.5) {
        console.error("[ModelDownloadService] Insufficient disk space");
        console.error(
          `[ModelDownloadService] Required: ${this.formatBytes(model.size * 1.5)}, Available: ${this.formatBytes(availableSpace)}`,
        );
        return false;
      }

      if (!model.huggingFaceRepo) {
        console.error(
          "[ModelDownloadService] No Hugging Face repository specified",
        );
        return false;
      }

      console.log(`[ModelDownloadService] Fetching files from: https://huggingface.co/${model.huggingFaceRepo}`);

      const knownModel = AVAILABLE_MODELS.find((m) => m.id === model.id);
      const subpath = knownModel?.huggingFaceSubpath;

      let files: HuggingFaceFile[];
      try {
        files = await this.fetchHuggingFaceRepoFiles(
          model.huggingFaceRepo,
          modelFormat,
          undefined,
          subpath,
        );
      } catch (fetchError) {
        console.error("[ModelDownloadService] Failed to fetch repository files:", fetchError);
        if (fetchError instanceof Error && fetchError.message.includes("404")) {
          console.error(`[ModelDownloadService] Repository not found: ${model.huggingFaceRepo}`);
          console.error("[ModelDownloadService] Please verify the repository exists at:");
          console.error(`  https://huggingface.co/${model.huggingFaceRepo}`);
        }
        return false;
      }

      if (files.length === 0) {
        console.error("[ModelDownloadService] No compatible files found in repository");
        console.error(`[ModelDownloadService] Expected format: ${modelFormat}`);
        console.error("[ModelDownloadService] Verify the repository contains MLX or CoreML model files");
        return false;
      }

      const modelPath = this.getModelPath(model.id, modelFormat);
      tempDir = `${this.getModelDirectory()}temp_${model.id}/`;

      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

      const startTime = Date.now();
      const resolvedTotalSize = files.reduce((sum, f) => sum + f.size, 0);
      const totalSize = resolvedTotalSize > 0 ? resolvedTotalSize : model.size;
      let totalBytesDownloaded = 0;
      const fileBytesStart = new Map<string, number>();

      console.log(
        `[ModelDownloadService] Downloading ${files.length} files, total: ${this.formatBytes(totalSize)}`,
      );

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const localFilePath = `${tempDir}${file.path}`;
        const localFileDir = localFilePath.substring(
          0,
          localFilePath.lastIndexOf("/"),
        );

        await FileSystem.makeDirectoryAsync(localFileDir, {
          intermediates: true,
        });

        fileBytesStart.set(file.path, totalBytesDownloaded);

        const success = await this.downloadHuggingFaceFile(
          model.huggingFaceRepo!,
          file.path,
          localFilePath,
          (currentFileBytes) => {
            const fileStartBytes = fileBytesStart.get(file.path) || 0;
            totalBytesDownloaded = fileStartBytes + currentFileBytes;

            if (onProgress) {
              onProgress(
                this.calculateProgress(
                  {
                    totalBytesWritten: totalBytesDownloaded,
                    totalBytesExpectedToWrite: totalSize,
                  },
                  model.id,
                  startTime,
                ),
              );
            }
          },
        );

        if (!success) {
          console.error(
            `[ModelDownloadService] Failed to download file: ${file.path}`,
          );
          await FileSystem.deleteAsync(tempDir, { idempotent: true });
          return false;
        }

        totalBytesDownloaded = fileBytesStart.get(file.path)! + file.size;
        console.log(
          `[ModelDownloadService] ✓ Downloaded ${i + 1}/${files.length}: ${file.path}`,
        );
      }

      const packageRoot = await resolveModelRoot({
        files,
        tempDir,
        format: modelFormat,
        pathExists: async (path) => {
          const info = await FileSystem.getInfoAsync(path);
          return info.exists;
        },
      });

      if (packageRoot) {
        console.log(
          `[ModelDownloadService] Using package root: ${packageRoot}`,
        );
      } else {
        console.warn(
          "[ModelDownloadService] Unable to locate package root, moving temp directory",
        );
      }

      try {
        await FileSystem.moveAsync({
          from: packageRoot ?? tempDir,
          to: modelPath,
        });
      } finally {
        await FileSystem.deleteAsync(tempDir, { idempotent: true });
      }

      const verified = await this.verifyDownload(
        model.id,
        modelPath,
        modelFormat,
      );

      if (verified) {
        console.log(
          `[ModelDownloadService] ✓ Download complete: ${model.name}`,
        );
        if (onProgress) {
          onProgress({
            modelId: model.id,
            bytesDownloaded: model.size,
            totalBytes: model.size,
            percentage: 100,
            speed: 0,
            estimatedTimeRemaining: 0,
            status: "completed",
          });
        }
        return true;
      } else {
        console.error("[ModelDownloadService] Verification failed");
        await FileSystem.deleteAsync(modelPath, { idempotent: true });
        return false;
      }
    } catch (error) {
      console.error("[ModelDownloadService] Download failed:", error);
      if (tempDir) {
        await FileSystem.deleteAsync(tempDir, { idempotent: true });
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
        console.error(
          "[ModelDownloadService] Failed to pause download:",
          error,
        );
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
        console.error(
          "[ModelDownloadService] Failed to resume download:",
          error,
        );
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
        console.error(
          "[ModelDownloadService] Failed to cancel download:",
          error,
        );
      }
    }
  }

  async deleteModel(modelId: string): Promise<boolean> {
    if (Platform.OS === "web") return false;

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
      console.error("[ModelDownloadService] Failed to delete model:", error);
      return false;
    }
  }

  async getModelSize(modelId: string): Promise<number> {
    if (Platform.OS === "web") return 0;

    try {
      const path = this.getModelPath(modelId);
      const info = await FileSystem.getInfoAsync(path);

      if (info.exists && "size" in info) {
        return info.size || 0;
      }

      return 0;
    } catch (error) {
      console.error("[ModelDownloadService] Failed to get model size:", error);
      return 0;
    }
  }

  async getDiskSpaceAvailable(): Promise<number> {
    if (Platform.OS === "web") return Infinity;

    try {
      const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
      return freeDiskStorage;
    } catch (error) {
      console.error("[ModelDownloadService] Failed to get disk space:", error);
      return 0;
    }
  }

  registerProgressCallback(
    modelId: string,
    callback: (progress: DownloadProgress) => void,
  ): void {
    this.progressCallbacks.set(modelId, callback);
  }

  unregisterProgressCallback(modelId: string): void {
    this.progressCallbacks.delete(modelId);
  }

  private calculateProgress(
    downloadProgress: FileSystem.DownloadProgressData,
    modelId: string,
    startTime: number,
  ): DownloadProgress {
    const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
    const percentage =
      totalBytesExpectedToWrite > 0
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
      status: percentage >= 100 ? "completed" : "downloading",
    };
  }

  private async verifyDownload(
    modelId: string,
    path: string,
    format: ModelDownloadFormat,
  ): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(path);

      if (!info.exists) {
        console.error("[ModelDownloadService] Downloaded file not found");
        return false;
      }

      if (format === "mlx") {
        const configPath = `${path}/config.json`;
        const configInfo = await FileSystem.getInfoAsync(configPath);

        if (!configInfo.exists) {
          console.error(
            "[ModelDownloadService] config.json not found in MLX package",
          );
          return false;
        }

        const weightCandidates = [
          "model.safetensors",
          "model.safetensors.index.json",
          "weights.safetensors",
          "weights.safetensors.index.json",
        ];

        let hasWeights = false;
        for (const filename of weightCandidates) {
          const weightInfo = await FileSystem.getInfoAsync(
            `${path}/${filename}`,
          );
          if (weightInfo.exists) {
            hasWeights = true;
            break;
          }
        }

        if (!hasWeights) {
          console.error(
            "[ModelDownloadService] MLX weights not found in package",
          );
          return false;
        }

        console.log(`[ModelDownloadService] Model verified: ${modelId}`);
        console.log(
          `[ModelDownloadService] Config exists: ${configInfo.exists}`,
        );
        console.log(`[ModelDownloadService] Weights exist: ${hasWeights}`);
        return true;
      }

      const manifestPath = `${path}/Manifest.json`;
      const manifestInfo = await FileSystem.getInfoAsync(manifestPath);

      if (!manifestInfo.exists) {
        console.warn(
          "[ModelDownloadService] Manifest.json not found in model package",
        );
      }

      const coremlModelPath = `${path}/Data/com.apple.CoreML/model.mlmodel`;
      const modelInfo = await FileSystem.getInfoAsync(coremlModelPath);

      if (!modelInfo.exists) {
        console.error(
          "[ModelDownloadService] model.mlmodel not found in package",
        );
        return false;
      }

      console.log(`[ModelDownloadService] Model verified: ${modelId}`);
      console.log(
        `[ModelDownloadService] Manifest exists: ${manifestInfo.exists}`,
      );
      console.log(`[ModelDownloadService] Model exists: ${modelInfo.exists}`);
      return true;
    } catch (error) {
      console.error("[ModelDownloadService] Verification failed:", error);
      return false;
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
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

  async getAvailableSpace(): Promise<{
    available: number;
    total: number;
    formatted: string;
  }> {
    if (Platform.OS === "web") {
      return { available: Infinity, total: Infinity, formatted: "Unlimited" };
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
      console.error("[ModelDownloadService] Failed to get disk space:", error);
      return { available: 0, total: 0, formatted: "Unknown" };
    }
  }

  async listDownloadedModels(): Promise<string[]> {
    if (Platform.OS === "web") return [];

    try {
      await this.ensureModelDirectory();
      const files = await FileSystem.readDirectoryAsync(
        this.getModelDirectory(),
      );
      return files.filter(
        (f) => f.endsWith(".mlpackage") || f.endsWith(".mlx"),
      );
    } catch (error) {
      console.error("[ModelDownloadService] Failed to list models:", error);
      return [];
    }
  }

  async compileModel(modelId: string): Promise<boolean> {
    if (Platform.OS !== "ios") {
      console.warn(
        "[ModelDownloadService] Model compilation only supported on iOS",
      );
      return true;
    }

    try {
      const format = this.getModelFormat(modelId);
      if (format === "mlx") {
        console.log(
          "[ModelDownloadService] MLX models do not require compilation",
        );
        return true;
      }

      const modelPath = this.getModelPath(modelId, format);
      const info = await FileSystem.getInfoAsync(modelPath);

      if (!info.exists) {
        console.error("[ModelDownloadService] Model not found for compilation");
        return false;
      }

      const manifestPath = `${modelPath}/Manifest.json`;
      const modelMLPath = `${modelPath}/Data/com.apple.CoreML/model.mlmodel`;

      const manifestExists = await FileSystem.getInfoAsync(manifestPath);
      const modelMLExists = await FileSystem.getInfoAsync(modelMLPath);

      if (!manifestExists.exists || !modelMLExists.exists) {
        console.error("[ModelDownloadService] Invalid model package structure");
        return false;
      }

      console.log(
        "[ModelDownloadService] Model package ready for CoreML:",
        modelPath,
      );
      console.log(
        "[ModelDownloadService] Structure verified: Manifest + model.mlmodel present",
      );
      return true;
    } catch (error) {
      console.error("[ModelDownloadService] Model compilation failed:", error);
      return false;
    }
  }

  getCompiledModelPath(modelId: string): string {
    return this.getModelPath(modelId);
  }
}

export const modelDownloadService = ModelDownloadService.getInstance();
export default modelDownloadService;
