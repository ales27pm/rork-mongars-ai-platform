import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { ModelRegistry } from "@/lib/utils/model-registry";
import type { ModelConfig } from "@/types";
import type { ModelCacheEntry } from "@/types/core-ml";

import {
  generateMockEmbedding,
  generateRealEmbedding,
} from "@/lib/utils/embedding";
import { useInstrumentation } from "./instrumentation";
import { Platform } from "react-native";
import { webLLMService } from "@/lib/services/web-llm";

const STORAGE_KEY = "mongars_llm_config";
const CACHE_STORAGE_KEY = "mongars_llm_cache";
const CACHE_LIMIT = 20;
const CACHE_TTL_MS = 5 * 60 * 1000;

const hashKey = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
};

const buildCacheKey = (prefix: string, payload: string): string => {
  return `${prefix}:${hashKey(payload)}`;
};

const getCachedEntry = (
  cacheRef: MutableRefObject<Map<string, ModelCacheEntry>>,
  key: string,
): { entry: ModelCacheEntry | null; mutated: boolean } => {
  const entry = cacheRef.current.get(key);
  if (!entry) return { entry: null, mutated: false };
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cacheRef.current.delete(key);
    return { entry: null, mutated: true };
  }

  const updated: ModelCacheEntry = {
    ...entry,
    hits: entry.hits + 1,
    timestamp: Date.now(),
  };
  cacheRef.current.delete(key);
  cacheRef.current.set(key, updated);
  return { entry: updated, mutated: true };
};

const setCachedEntry = (
  cacheRef: MutableRefObject<Map<string, ModelCacheEntry>>,
  key: string,
  result: string | number[],
): ModelCacheEntry => {
  if (cacheRef.current.size >= CACHE_LIMIT) {
    const oldestKey = cacheRef.current.keys().next().value;
    if (oldestKey) {
      cacheRef.current.delete(oldestKey);
    }
  }

  const size = typeof result === "string" ? result.length : result.length * 8;
  const entry: ModelCacheEntry = {
    key,
    result,
    timestamp: Date.now(),
    hits: 0,
    size,
  };
  cacheRef.current.set(key, entry);
  return entry;
};

interface LLMMetrics {
  totalInferences: number;
  totalEmbeddings: number;
  avgInferenceTime: number;
  avgEmbeddingTime: number;
  modelSwitches: number;
  lastInferenceTime?: number;
}

interface InferenceRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  streaming?: boolean;
}

interface EmbeddingRequest {
  text: string;
  normalize?: boolean;
}

const countTokensForModel = (model: ModelConfig, text: string): number => {
  const countTokensFn = model.tokenizer?.countTokens;
  if (typeof countTokensFn === "function") {
    return countTokensFn(text);
  }

  const estimatedTokens = Math.max(Math.ceil(text.length / 4), 1);
  console.warn(
    `[UnifiedLLM] No tokenizer configured for ${model.name}; using heuristic estimate: ${estimatedTokens} tokens`,
  );
  return estimatedTokens;
};

export const [UnifiedLLMProvider, useUnifiedLLM] = createContextHook(() => {
  const instrumentation = useInstrumentation();
  const modelRegistry = useRef(new ModelRegistry());
  const [activeModel, setActiveModel] = useState<ModelConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState<LLMMetrics>({
    totalInferences: 0,
    totalEmbeddings: 0,
    avgInferenceTime: 0,
    avgEmbeddingTime: 0,
    modelSwitches: 0,
  });

  const generationCache = useRef<Map<string, ModelCacheEntry>>(new Map());
  const embeddingCache = useRef<Map<string, ModelCacheEntry>>(new Map());

  const inferenceInProgress = useRef(false);
  const embeddingInProgress = useRef(false);

  const pruneCache = useCallback(
    (cacheRef: MutableRefObject<Map<string, ModelCacheEntry>>): void => {
      const now = Date.now();
      for (const [key, entry] of cacheRef.current.entries()) {
        if (now - entry.timestamp > CACHE_TTL_MS) {
          cacheRef.current.delete(key);
        }
      }
    },
    [],
  );

  const saveCache = useCallback(async () => {
    try {
      pruneCache(generationCache);
      pruneCache(embeddingCache);

      const now = Date.now();
      const serialize = (
        cacheRef: MutableRefObject<Map<string, ModelCacheEntry>>,
      ) =>
        Array.from(cacheRef.current.values())
          .filter((entry) => now - entry.timestamp <= CACHE_TTL_MS)
          .slice(-CACHE_LIMIT);

      const payload = {
        generation: serialize(generationCache),
        embedding: serialize(embeddingCache),
      };

      await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload));
      console.log(
        `[UnifiedLLM] Cache saved (${payload.generation.length} generations, ${payload.embedding.length} embeddings)`,
      );
    } catch (error) {
      console.error("[UnifiedLLM] Cache save error:", error);
    }
  }, [pruneCache]);

  const loadCache = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
      if (!stored) return;

      let parsed;
      try {
        parsed = JSON.parse(stored) as {
          generation?: ModelCacheEntry[];
          embedding?: ModelCacheEntry[];
        };
      } catch (parseError) {
        console.error("[UnifiedLLM] Cache parse error:", parseError);
        console.error("[UnifiedLLM] Corrupted cache data, clearing...");
        await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
        return;
      }
      const now = Date.now();
      const hydrate = (entries?: ModelCacheEntry[]) => {
        if (!Array.isArray(entries)) return [] as ModelCacheEntry[];
        return entries
          .filter((entry) => now - entry.timestamp <= CACHE_TTL_MS)
          .slice(-CACHE_LIMIT)
          .sort((a, b) => a.timestamp - b.timestamp);
      };

      const hydratedGeneration = hydrate(parsed.generation);
      const hydratedEmbedding = hydrate(parsed.embedding);

      generationCache.current = new Map(
        hydratedGeneration.map((entry) => [entry.key, entry]),
      );
      embeddingCache.current = new Map(
        hydratedEmbedding.map((entry) => [entry.key, entry]),
      );

      console.log(
        `[UnifiedLLM] Loaded cache (${hydratedGeneration.length} generations, ${hydratedEmbedding.length} embeddings)`,
      );
    } catch (error) {
      console.error("[UnifiedLLM] Cache load error:", error);
      await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const config = JSON.parse(stored);
          modelRegistry.current.importConfig(config);
          console.log("[UnifiedLLM] Successfully loaded stored configuration");
        } catch (parseError) {
          console.error(
            "[UnifiedLLM] JSON parse error, clearing corrupted data:",
            parseError,
          );
          console.error(
            "[UnifiedLLM] Corrupted data preview:",
            stored.substring(0, 100),
          );
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
      const active = modelRegistry.current.getActiveModel();
      setActiveModel(active);
      console.log(
        `[UnifiedLLM] Loaded configuration - Active: ${active?.name || "None"}`,
      );
    } catch (error) {
      console.error("[UnifiedLLM] Load error:", error);
    }
  }, []);

  const saveConfig = useCallback(async () => {
    try {
      const config = modelRegistry.current.exportConfig();
      const serialized = JSON.stringify(config);
      await AsyncStorage.setItem(STORAGE_KEY, serialized);
      console.log(
        `[UnifiedLLM] Configuration saved (${serialized.length} bytes)`,
      );
    } catch (error) {
      console.error("[UnifiedLLM] Save error:", error);
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadCache();
  }, [loadCache, loadConfig]);

  const switchModel = useCallback(
    async (modelId: string): Promise<boolean> => {
      console.log(`[UnifiedLLM] Switching to model: ${modelId}`);
      setIsLoading(true);

      if (inferenceInProgress.current || embeddingInProgress.current) {
        console.warn("[UnifiedLLM] Cannot switch model during inference");
        setIsLoading(false);
        return false;
      }

      const success = modelRegistry.current.setActiveModel(modelId);

      if (success) {
        const newModel = modelRegistry.current.getActiveModel();
        setActiveModel(newModel);
        setMetrics((prev) => ({
          ...prev,
          modelSwitches: prev.modelSwitches + 1,
        }));
        await saveConfig();
        console.log(`[UnifiedLLM] Successfully switched to ${newModel?.name}`);
      }

      setIsLoading(false);
      return success;
    },
    [saveConfig],
  );

  const generate = useCallback(
    async (request: InferenceRequest): Promise<string> => {
      if (inferenceInProgress.current) {
        console.warn("[UnifiedLLM] Inference already in progress, queueing...");
        await new Promise((resolve) => setTimeout(resolve, 100));
        return generate(request);
      }

      const model = modelRegistry.current.getActiveModel();
      if (!model) {
        throw new Error("[UnifiedLLM] No active model configured");
      }

      const promptTokens = countTokensForModel(model, request.prompt);
      const maxTokens = request.maxTokens ?? 100;
      const totalRequestedTokens = promptTokens + maxTokens;

      if (totalRequestedTokens > model.contextWindow) {
        const available = Math.max(model.contextWindow - promptTokens, 0);
        const errorMessage = `[UnifiedLLM] Token budget exceeded: prompt=${promptTokens}, requested=${maxTokens}, context=${model.contextWindow}`;
        console.warn(errorMessage);
        throw new Error(
          `Prompt exceeds context window for ${model.name}. Available completion tokens: ${available}`,
        );
      }

      const cacheKey = buildCacheKey(
        "gen",
        `${model.modelId}:${request.prompt}:${maxTokens}`,
      );
      if (!request.streaming) {
        const { entry: cached, mutated } = getCachedEntry(
          generationCache,
          cacheKey,
        );
        if (mutated) {
          void saveCache();
        }
        if (cached && typeof cached.result === "string") {
          console.log(`[UnifiedLLM] Cache hit for generation (${cacheKey})`);
          setMetrics((prev) => ({
            ...prev,
            totalInferences: prev.totalInferences + 1,
            lastInferenceTime: 0,
          }));
          return cached.result;
        }
      }

      const endOp = instrumentation.startOperation("unified-llm", "generate", {
        modelId: model.modelId,
      });
      inferenceInProgress.current = true;
      const startTime = Date.now();

      try {
        console.log(
          `[UnifiedLLM] Generating with ${model.name} (${model.modelId})`,
        );
        console.log(
          `[UnifiedLLM] Prompt length: ${request.prompt.length} chars (${promptTokens} tokens, max ${model.contextWindow})`,
        );
        console.log("[UnifiedLLM] On-device mode: using local CoreML model");

        const response = await generateOnDevice(
          model,
          request.prompt,
          maxTokens,
        );

        const duration = Date.now() - startTime;

        setMetrics((prev) => ({
          ...prev,
          totalInferences: prev.totalInferences + 1,
          avgInferenceTime:
            (prev.avgInferenceTime * prev.totalInferences + duration) /
            (prev.totalInferences + 1),
          lastInferenceTime: duration,
        }));

        console.log(
          `[UnifiedLLM] Generated ${response.length} chars in ${duration}ms`,
        );

        if (!request.streaming) {
          setCachedEntry(generationCache, cacheKey, response);
          await saveCache();
        }

        return response;
      } catch (error) {
        console.error("[UnifiedLLM] Inference error:", error);

        const fallbackModel = modelRegistry.current.getFallbackModel();
        if (fallbackModel && fallbackModel.id !== model.id) {
          console.log(
            `[UnifiedLLM] Attempting fallback to ${fallbackModel.name}`,
          );
          try {
            const response = await generateOnDevice(
              fallbackModel,
              request.prompt,
              request.maxTokens || 100,
            );
            return response;
          } catch (fallbackError) {
            console.error("[UnifiedLLM] Fallback failed:", fallbackError);
            throw fallbackError;
          }
        }

        throw error;
      } finally {
        inferenceInProgress.current = false;
        endOp();
      }
    },
    [instrumentation, saveCache],
  );

  const embed = useCallback(
    async (request: EmbeddingRequest): Promise<number[]> => {
      if (embeddingInProgress.current) {
        console.warn("[UnifiedLLM] Embedding already in progress, queueing...");
        await new Promise((resolve) => setTimeout(resolve, 50));
        return embed(request);
      }

      const model = modelRegistry.current.getEmbeddingModel();
      if (!model) {
        throw new Error("No embedding model configured");
      }

      const cacheKey = buildCacheKey(
        "embed",
        `${model.modelId}:${request.text}:${request.normalize ?? true}`,
      );
      const { entry: cached, mutated } = getCachedEntry(
        embeddingCache,
        cacheKey,
      );
      if (mutated) {
        void saveCache();
      }
      if (cached && Array.isArray(cached.result)) {
        console.log(`[UnifiedLLM] Embedding cache hit (${cacheKey})`);
        setMetrics((prev) => ({
          ...prev,
          totalEmbeddings: prev.totalEmbeddings + 1,
        }));
        return cached.result as number[];
      }

      const endOp = instrumentation.startOperation("unified-llm", "embed", {
        modelId: model.modelId,
      });
      embeddingInProgress.current = true;
      const startTime = Date.now();

      try {
        console.log(`[UnifiedLLM] Embedding with ${model.name}`);

        let embedding: number[];

        if (Platform.OS === "web" && model.provider === "webllm") {
          try {
            embedding = await webLLMService.generateEmbedding(request.text, {
              modelId: model.modelId,
              normalize: request.normalize ?? true,
            });
          } catch (error) {
            console.warn(
              "[UnifiedLLM] WebLLM embedding failed, falling back:",
              error,
            );
            embedding = await generateRealEmbedding(request.text);
          }
        } else {
          embedding = await generateRealEmbedding(request.text);
        }

        const duration = Date.now() - startTime;

        setMetrics((prev) => ({
          ...prev,
          totalEmbeddings: prev.totalEmbeddings + 1,
          avgEmbeddingTime:
            (prev.avgEmbeddingTime * prev.totalEmbeddings + duration) /
            (prev.totalEmbeddings + 1),
        }));

        setCachedEntry(embeddingCache, cacheKey, embedding);
        await saveCache();

        console.log(
          `[UnifiedLLM] Generated embedding (${embedding.length}D) in ${duration}ms`,
        );

        return embedding;
      } catch (error) {
        console.error("[UnifiedLLM] Embedding error:", error);
        throw error;
      } finally {
        embeddingInProgress.current = false;
        endOp();
      }
    },
    [instrumentation, saveCache],
  );

  const getModelInfo = useCallback(() => {
    return {
      active: modelRegistry.current.getActiveModel(),
      embedding: modelRegistry.current.getEmbeddingModel(),
      fallback: modelRegistry.current.getFallbackModel(),
      stats: modelRegistry.current.getStats(),
    };
  }, []);

  const listModels = useCallback(() => {
    return modelRegistry.current.listAvailableModels();
  }, []);

  const getCapableModels = useCallback(
    (capability: keyof ModelConfig["capabilities"]) => {
      return modelRegistry.current.getModelsByCapability(capability);
    },
    [],
  );

  const generateOnDevice = async (
    model: ModelConfig,
    prompt: string,
    maxTokens: number,
  ): Promise<string> => {
    if (Platform.OS === "web") {
      console.log("[UnifiedLLM] Using WebLLM generation via WebGPU");
      if (model.provider !== "webllm") {
        console.warn(
          `[UnifiedLLM] Active model ${model.name} is not WebLLM-compatible; falling back to default WebLLM model`,
        );
      }
      return webLLMService.generateText(prompt, {
        modelId: model.provider === "webllm" ? model.modelId : undefined,
        maxTokens,
        temperature: 0.7,
        topP: 0.9,
      });
    }

    console.log("[UnifiedLLM] Using on-device generation via DolphinCoreML");

    const { dolphinCoreML } = await import("@/lib/modules/DolphinCoreML");

    try {
      const response = await dolphinCoreML.generate(prompt, {
        maxTokens,
        temperature: 0.7,
        topP: 0.9,
      });

      console.log(
        `[UnifiedLLM] On-device generation complete: ${response.length} chars`,
      );
      return response;
    } catch (error) {
      console.error("[UnifiedLLM] On-device generation failed:", error);
      throw error;
    }
  };

  const setEmbeddingModel = useCallback(
    async (modelId: string): Promise<boolean> => {
      const success = modelRegistry.current.setEmbeddingModel(modelId);
      if (success) {
        await saveConfig();
      }
      return success;
    },
    [saveConfig],
  );

  const setFallbackModel = useCallback(
    async (modelId: string): Promise<boolean> => {
      const success = modelRegistry.current.setFallbackModel(modelId);
      if (success) {
        await saveConfig();
      }
      return success;
    },
    [saveConfig],
  );

  return {
    activeModel,
    isLoading,
    metrics,
    generate,
    embed,
    switchModel,
    setEmbeddingModel,
    setFallbackModel,
    getModelInfo,
    listModels,
    getCapableModels,
    inferenceInProgress: inferenceInProgress.current,
    embeddingInProgress: embeddingInProgress.current,
  };
});
