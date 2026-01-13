import { hfUrl, listRepoFiles } from "@/lib/services/huggingface-client";

describe("huggingface-client", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("builds resolve URLs", () => {
    expect(
      hfUrl({
        repo: "org/model",
        path: "weights.bin",
      }),
    ).toBe("https://huggingface.co/org/model/resolve/main/weights.bin");
  });

  it("lists repository files", async () => {
    const mockJson = jest
      .fn()
      .mockResolvedValue([
        { path: "config.json", type: "file" },
        { path: "model.safetensors", type: "file" },
      ]);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: mockJson,
    });

    const files = await listRepoFiles({ repo: "org/model" });

    expect(files).toEqual(["config.json", "model.safetensors"]);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://huggingface.co/api/models/org/model/tree/main?recursive=1",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("throws on API errors", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: jest.fn(),
    });

    await expect(listRepoFiles({ repo: "org/missing" })).rejects.toThrow(
      "Hugging Face API error 404 for org/missing@main",
    );
  });
});
