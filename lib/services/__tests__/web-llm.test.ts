import { webLLMService } from "../web-llm";

describe("webLLMService", () => {
  it("reports WebGPU as unsupported in the test environment", () => {
    expect(webLLMService.isWebGPUSupported()).toBe(false);
    expect(webLLMService.getStatus().webgpuSupported).toBe(false);
  });
});
