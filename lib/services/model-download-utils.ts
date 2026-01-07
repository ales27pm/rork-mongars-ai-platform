export type ModelDownloadFormat = "coreml" | "mlx";

export interface HuggingFaceFile {
  path: string;
  size: number;
  lfs?: {
    oid: string;
    size: number;
    pointerSize: number;
  };
}

const ML_PACKAGE_REGEX = /(.+\.mlpackage)(?:\/|$)/;

const normalizePath = (path: string): string => path.replace(/\/+$/, "");

const getDirectoryPrefix = (path: string): string => {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) return "";
  return path.slice(0, lastSlash + 1);
};

const getCoreMLRoots = (files: HuggingFaceFile[]): string[] => {
  const roots = new Set<string>();

  for (const file of files) {
    const match = file.path.match(ML_PACKAGE_REGEX);
    if (match?.[1]) {
      roots.add(normalizePath(match[1]));
    }
  }

  return Array.from(roots);
};

const getMLXRoots = (files: HuggingFaceFile[]): string[] => {
  const roots = new Set<string>();

  for (const file of files) {
    if (
      file.path.endsWith("config.json") ||
      file.path.endsWith("tokenizer.json") ||
      file.path.endsWith("tokenizer.model") ||
      file.path.endsWith(".safetensors") ||
      file.path.endsWith(".safetensors.index.json")
    ) {
      const prefix = getDirectoryPrefix(file.path);
      roots.add(normalizePath(prefix));
    }
  }

  return Array.from(roots);
};

const getMLXWeightFiles = (files: HuggingFaceFile[]): string[] => {
  const weights = new Set<string>();

  for (const file of files) {
    if (
      file.path.endsWith(".safetensors") ||
      file.path.endsWith(".safetensors.index.json")
    ) {
      weights.add(file.path);
    }
  }

  return Array.from(weights);
};

const buildCandidatePaths = (
  files: HuggingFaceFile[],
  tempDir: string,
  format: ModelDownloadFormat,
): string[] => {
  const candidates = new Set<string>();
  const roots = format === "mlx" ? getMLXRoots(files) : getCoreMLRoots(files);

  for (const root of roots) {
    if (root) {
      candidates.add(`${tempDir}${root}`);
    }
  }

  if (format === "coreml") {
    candidates.add(`${tempDir}model.mlpackage`);
  }

  candidates.add(normalizePath(tempDir));

  return Array.from(candidates);
};

export interface ResolveModelRootOptions {
  files: HuggingFaceFile[];
  tempDir: string;
  format: ModelDownloadFormat;
  pathExists: (path: string) => Promise<boolean>;
}

const hasCoreMLStructure = async (
  rootPath: string,
  pathExists: (path: string) => Promise<boolean>,
): Promise<boolean> => {
  const manifestPath = `${rootPath}/Manifest.json`;
  const modelPath = `${rootPath}/Data/com.apple.CoreML/model.mlmodel`;

  return (await pathExists(manifestPath)) && (await pathExists(modelPath));
};

const hasMLXStructure = async (
  rootPath: string,
  weightFiles: string[],
  pathExists: (path: string) => Promise<boolean>,
): Promise<boolean> => {
  const configPath = `${rootPath}/config.json`;
  const hasConfig = await pathExists(configPath);
  if (!hasConfig) {
    return false;
  }

  if (weightFiles.length === 0) {
    return false;
  }

  for (const weightFile of weightFiles) {
    const candidateRelative = weightFile.startsWith("/")
      ? weightFile.slice(1)
      : weightFile;
    if (await pathExists(`${rootPath}/${candidateRelative}`)) {
      return true;
    }

    const filename = weightFile.split("/").pop();
    if (filename && (await pathExists(`${rootPath}/${filename}`))) {
      return true;
    }
  }

  return false;
};

export const resolveModelRoot = async ({
  files,
  tempDir,
  format,
  pathExists,
}: ResolveModelRootOptions): Promise<string | null> => {
  const candidates = buildCandidatePaths(files, tempDir, format);
  const weightFiles = format === "mlx" ? getMLXWeightFiles(files) : [];

  for (const candidate of candidates) {
    if (format === "coreml") {
      if (await hasCoreMLStructure(candidate, pathExists)) {
        return candidate;
      }
    } else if (await hasMLXStructure(candidate, weightFiles, pathExists)) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
};
