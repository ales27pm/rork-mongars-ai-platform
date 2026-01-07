import { resolveModelRoot } from "@/lib/services/model-download-utils";

const makePathExists = (existing: Set<string>) => async (path: string) =>
  existing.has(path);

describe("resolveModelRoot", () => {
  it("prefers a valid nested .mlpackage root", async () => {
    const tempDir = "/tmp/model/";
    const files = [
      {
        path: "coreml/model.mlpackage/Manifest.json",
        size: 10,
      },
      {
        path: "coreml/model.mlpackage/Data/com.apple.CoreML/model.mlmodel",
        size: 20,
      },
    ];

    const existing = new Set<string>([
      "/tmp/model/coreml/model.mlpackage/Manifest.json",
      "/tmp/model/coreml/model.mlpackage/Data/com.apple.CoreML/model.mlmodel",
    ]);

    const result = await resolveModelRoot({
      files,
      tempDir,
      format: "coreml",
      pathExists: makePathExists(existing),
    });

    expect(result).toBe("/tmp/model/coreml/model.mlpackage");
  });

  it("falls back to the temp directory when it contains a package structure", async () => {
    const tempDir = "/tmp/model/";
    const files = [
      {
        path: "Manifest.json",
        size: 10,
      },
      {
        path: "Data/com.apple.CoreML/model.mlmodel",
        size: 20,
      },
    ];

    const existing = new Set<string>([
      "/tmp/model/Manifest.json",
      "/tmp/model/Data/com.apple.CoreML/model.mlmodel",
      "/tmp/model",
    ]);

    const result = await resolveModelRoot({
      files,
      tempDir,
      format: "coreml",
      pathExists: makePathExists(existing),
    });

    expect(result).toBe("/tmp/model");
  });

  it("returns the first existing candidate when no package structure is found", async () => {
    const tempDir = "/tmp/model/";
    const files = [
      {
        path: "model.mlpackage/README.md",
        size: 10,
      },
    ];

    const existing = new Set<string>(["/tmp/model/model.mlpackage"]);

    const result = await resolveModelRoot({
      files,
      tempDir,
      format: "coreml",
      pathExists: makePathExists(existing),
    });

    expect(result).toBe("/tmp/model/model.mlpackage");
  });

  it("resolves an MLX root when config and weights exist", async () => {
    const tempDir = "/tmp/model/";
    const files = [
      {
        path: "mlx/config.json",
        size: 10,
      },
      {
        path: "mlx/model.safetensors",
        size: 20,
      },
    ];

    const existing = new Set<string>([
      "/tmp/model/mlx/config.json",
      "/tmp/model/mlx/model.safetensors",
    ]);

    const result = await resolveModelRoot({
      files,
      tempDir,
      format: "mlx",
      pathExists: makePathExists(existing),
    });

    expect(result).toBe("/tmp/model/mlx");
  });
});
