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
  ): Promise<HuggingFaceFile[]> {
    console.log(
      "[ModelDownloadService] Fetching repository structure:",
      repoId,
    );

    try {
      const apiUrl = `https://huggingface.co/api/models/${repoId}/tree/main`;
      console.log("[ModelDownloadService] Fetching from HF API:", apiUrl);

      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(apiUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        console.log(
          "[ModelDownloadService] API response:",
          response.status,
          response.statusText,
        );
        const text = await response.text();
        console.log(
          "[ModelDownloadService] Response body:",
          text.substring(0, 500),
        );
        return this.fetchHuggingFaceRepoFilesAlternative(repoId, format);
      }

      const data = await response.json();
      console.log(
        "[ModelDownloadService] Received file tree with",
        data.length,
        "items",
      );

      const allFiles = data.filter((item: any) => item.type === "file");
      console.log("[ModelDownloadService] Total files:", allFiles.length);
      console.log(
        "[ModelDownloadService] Sample files:",
        allFiles.slice(0, 5).map((f: any) => f.path),
      );

      const selectedFiles = data
        .filter((item: any) => item.type === "file")
        .filter((item: any) => {
          if (format === "mlx") {
            return (
              item.path.endsWith(".safetensors") ||
              item.path.endsWith(".safetensors.index.json") ||
              item.path.endsWith("config.json") ||
              item.path.endsWith("tokenizer.json") ||
              item.path.endsWith("tokenizer.model") ||
              item.path.endsWith("tokenizer_config.json") ||
              item.path.endsWith("generation_config.json") ||
              item.path.endsWith("special_tokens_map.json") ||
              item.path.endsWith("vocab.json") ||
              item.path.endsWith("merges.txt")
            );
          }

          return (
            item.path.includes(".mlpackage") ||
            item.path.endsWith(".mlmodel") ||
            item.path.endsWith(".bin") ||
            item.path.endsWith("Manifest.json") ||
            item.path.endsWith("weights.bin") ||
            item.path.includes("coreml")
          );
        })
        .map((item: any) => ({
          path: item.path,
          size: item.lfs?.size || item.size || 0,
          lfs: item.lfs
            ? {
                oid: item.lfs.oid,
                size: item.lfs.size,
                pointerSize: item.lfs.pointerSize,
              }
            : undefined,
        }));

      if (selectedFiles.length > 0) {
        console.log(
          "[ModelDownloadService] Found",
          selectedFiles.length,
          format === "mlx" ? "MLX files" : "CoreML files",
        );
        selectedFiles.forEach((f: HuggingFaceFile) =>
          console.log(`  - ${f.path} (${this.formatBytes(f.size)})`),
        );
        return selectedFiles;
      }

      console.log(
        `[ModelDownloadService] No ${format} files found in API response, using fallback`,
      );
      return this.fetchHuggingFaceRepoFilesAlternative(repoId, format);
    } catch (error) {
      console.error("[ModelDownloadService] API fetch error:", error);
      if (error instanceof Error) {
        console.error("[ModelDownloadService] Error details:", error.message);
      }
      return this.fetchHuggingFaceRepoFilesAlternative(repoId, format);
    }
  }

  private async fetchHuggingFaceRepoFilesAlternative(
    repoId: string,
    format: ModelDownloadFormat,
  ): Promise<HuggingFaceFile[]> {
    console.log(
      "[ModelDownloadService] Using direct file discovery for:",
      repoId,
    );

    if (format === "mlx") {
      const candidatePrefixes = ["", "mlx/", "model/", "weights/"];
      const requiredFiles = [
        "config.json",
        "tokenizer.json",
        "tokenizer.model",
        "tokenizer_config.json",
        "generation_config.json",
        "special_tokens_map.json",
        "vocab.json",
        "merges.txt",
      ];
      const weightFiles = [
        "model.safetensors",
        "model.safetensors.index.json",
        "weights.safetensors",
        "weights.safetensors.index.json",
      ];

      for (const prefix of candidatePrefixes) {
        const configPath = `${prefix}config.json`;
        const configUrl = `https://huggingface.co/${repoId}/resolve/main/${configPath}`;

        try {
          const configResponse = await fetch(configUrl, {
            method: "HEAD",
            signal: AbortSignal.timeout(10000),
            redirect: "follow",
          });

          if (!configResponse.ok) {
            continue;
          }

          const filesWithSizes: HuggingFaceFile[] = [];

          for (const filename of requiredFiles) {
            const filePath = `${prefix}${filename}`;
            try {
              const fileUrl = `https://huggingface.co/${repoId}/resolve/main/${filePath}`;
              const headResponse = await fetch(fileUrl, {
                method: "HEAD",
                signal: AbortSignal.timeout(10000),
                redirect: "follow",
              });
              if (headResponse.ok) {
                const size = headResponse.headers.get("content-length");
                filesWithSizes.push({
                  path: filePath,
                  size: size ? parseInt(size, 10) : 0,
                });
              }
            } catch {
              continue;
            }
          }

          let hasWeights = false;
          for (const filename of weightFiles) {
            const filePath = `${prefix}${filename}`;
            try {
              const fileUrl = `https://huggingface.co/${repoId}/resolve/main/${filePath}`;
              const headResponse = await fetch(fileUrl, {
                method: "HEAD",
                signal: AbortSignal.timeout(10000),
                redirect: "follow",
              });
              if (headResponse.ok) {
                const size = headResponse.headers.get("content-length");
                filesWithSizes.push({
                  path: filePath,
                  size: size ? parseInt(size, 10) : 0,
                });
                hasWeights = true;
              }
            } catch {
              continue;
            }
          }

          if (hasWeights) {
            const totalSize = filesWithSizes.reduce(
              (sum, f) => sum + f.size,
              0,
            );
            console.log(
              `[ModelDownloadService] Total download size: ${this.formatBytes(totalSize)}`,
            );
            return filesWithSizes;
          }
        } catch (error) {
          console.log(
            "[ModelDownloadService] MLX structure test failed:",
            error instanceof Error ? error.message : "Unknown error",
          );
        }
      }

      throw new Error(
        `Could not find valid MLX model structure for ${repoId}.`,
      );
    }

    const possibleStructures = [
      [
        "coreml/coreml-model.mlpackage/Manifest.json",
        "coreml/coreml-model.mlpackage/Data/com.apple.CoreML/model.mlmodel",
        "coreml/coreml-model.mlpackage/Data/com.apple.CoreML/weights/weight.bin",
      ],
      [
        "model.mlpackage/Manifest.json",
        "model.mlpackage/Data/com.apple.CoreML/model.mlmodel",
        "model.mlpackage/Data/com.apple.CoreML/weights/weight.bin",
      ],
      [
        "Manifest.json",
        "Data/com.apple.CoreML/model.mlmodel",
        "Data/com.apple.CoreML/weights/weight.bin",
      ],
      [
        "coreml/Manifest.json",
        "coreml/Data/com.apple.CoreML/model.mlmodel",
        "coreml/Data/com.apple.CoreML/weights/weight.bin",
      ],
    ];

    for (const structure of possibleStructures) {
      const testUrl = `https://huggingface.co/${repoId}/resolve/main/${structure[0]}`;
      console.log("[ModelDownloadService] Testing structure:", structure[0]);

      try {
        const testResponse = await fetch(testUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(10000),
          redirect: "follow",
        });

        console.log(
          `[ModelDownloadService] Test response: ${testResponse.status} ${testResponse.statusText}`,
        );

        if (testResponse.ok) {
          console.log("[ModelDownloadService] ✓ Found valid structure!");

          const filesWithSizes = await Promise.all(
            structure.map(async (path) => {
              try {
                const fileUrl = `https://huggingface.co/${repoId}/resolve/main/${path}`;
                const headResponse = await fetch(fileUrl, {
                  method: "HEAD",
                  signal: AbortSignal.timeout(10000),
                  redirect: "follow",
                });

                const size = headResponse.headers.get("content-length");
                const actualSize = size ? parseInt(size, 10) : 0;
                console.log(
                  `[ModelDownloadService]   ${path}: ${this.formatBytes(actualSize)}`,
                );

                return {
                  path,
                  size: actualSize,
                };
              } catch {
                console.log(
                  `[ModelDownloadService]   ${path}: Failed to fetch size`,
                );
                return {
                  path,
                  size: 1024 * 1024,
                };
              }
            }),
          );

          const totalSize = filesWithSizes.reduce((sum, f) => sum + f.size, 0);
          console.log(
            `[ModelDownloadService] Total download size: ${this.formatBytes(totalSize)}`,
          );

          return filesWithSizes;
        }
      } catch (error) {
        console.log(
          "[ModelDownloadService] Structure test failed:",
          error instanceof Error ? error.message : "Unknown error",
        );
        continue;
      }
    }

    throw new Error(
      `Could not find valid model structure for ${repoId}. Please verify the repository contains a CoreML model.`,
    );
  }

  private async downloadHuggingFaceFile(
    repoId: string,
    filePath: string,
    localPath: string,
    onProgress?: (bytes: number) => void,
  ): Promise<boolean> {
    try {
      const url = `https://huggingface.co/${repoId}/resolve/main/${filePath}`;
      console.log("[ModelDownloadService] Downloading file:");
      console.log(`  URL: ${url}`);
      console.log(`  Destination: ${localPath}`);

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
            "User-Agent": "Mozilla/5.0",
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
        return false;
      }
    } catch (error) {
      console.error(
        "[ModelDownloadService] Download error for file:",
        filePath,
      );
      if (error instanceof Error) {
        console.error("[ModelDownloadService] Error:", error.message);
        console.error("[ModelDownloadService] Stack:", error.stack);
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

      const files = await this.fetchHuggingFaceRepoFiles(
        model.huggingFaceRepo,
        modelFormat,
      );

      if (files.length === 0) {
        console.error("[ModelDownloadService] No files found in repository");
        return false;
      }

      const modelPath = this.getModelPath(model.id, modelFormat);
      const tempDir = `${this.getModelDirectory()}temp_${model.id}/`;

      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

      const startTime = Date.now();
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
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
