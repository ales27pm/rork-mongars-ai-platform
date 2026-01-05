import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ModelRegistry } from '@/lib/utils/model-registry';
import type { ModelConfig } from '@/types';

import { generateMockEmbedding } from '@/lib/utils/embedding';
import { useInstrumentation } from './instrumentation';

const STORAGE_KEY = 'mongars_llm_config';

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
  if (model.tokenizer?.countTokens) {
    return model.tokenizer.countTokens(text);
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

  const inferenceInProgress = useRef(false);
  const embeddingInProgress = useRef(false);

  const loadConfig = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const config = JSON.parse(stored);
          modelRegistry.current.importConfig(config);
          console.log('[UnifiedLLM] Successfully loaded stored configuration');
        } catch (parseError) {
          console.error('[UnifiedLLM] JSON parse error, clearing corrupted data:', parseError);
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
      const active = modelRegistry.current.getActiveModel();
      setActiveModel(active);
      console.log(`[UnifiedLLM] Loaded configuration - Active: ${active?.name || 'None'}`);
    } catch (error) {
      console.error('[UnifiedLLM] Load error:', error);
    }
  }, []);

  const saveConfig = useCallback(async () => {
    try {
      const config = modelRegistry.current.exportConfig();
      const serialized = JSON.stringify(config);
      await AsyncStorage.setItem(STORAGE_KEY, serialized);
      console.log(`[UnifiedLLM] Configuration saved (${serialized.length} bytes)`);
    } catch (error) {
      console.error('[UnifiedLLM] Save error:', error);
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const switchModel = useCallback(async (modelId: string): Promise<boolean> => {
    console.log(`[UnifiedLLM] Switching to model: ${modelId}`);
    setIsLoading(true);

    if (inferenceInProgress.current || embeddingInProgress.current) {
      console.warn('[UnifiedLLM] Cannot switch model during inference');
      setIsLoading(false);
      return false;
    }

    const success = modelRegistry.current.setActiveModel(modelId);
    
    if (success) {
      const newModel = modelRegistry.current.getActiveModel();
      setActiveModel(newModel);
      setMetrics(prev => ({
        ...prev,
        modelSwitches: prev.modelSwitches + 1,
      }));
      await saveConfig();
      console.log(`[UnifiedLLM] Successfully switched to ${newModel?.name}`);
    }

    setIsLoading(false);
    return success;
  }, [saveConfig]);

  const generate = useCallback(async (request: InferenceRequest): Promise<string> => {
    if (inferenceInProgress.current) {
      console.warn('[UnifiedLLM] Inference already in progress, queueing...');
      await new Promise(resolve => setTimeout(resolve, 100));
      return generate(request);
    }

    const model = modelRegistry.current.getActiveModel();
    if (!model) {
      throw new Error(
        `Requested tokens (${totalRequestedTokens}) exceed the context window (${model.contextWindow}) for ${model.name}. Available completion tokens: ${available}.`,
      );
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

    const endOp = instrumentation.startOperation('unified-llm', 'generate', { modelId: model.modelId });
    inferenceInProgress.current = true;
    const startTime = Date.now();

    try {
      console.log(`[UnifiedLLM] Generating with ${model.name} (${model.modelId})`);
      console.log(
        `[UnifiedLLM] Prompt length: ${request.prompt.length} chars (${promptTokens} tokens, max ${model.contextWindow})`,
      );
      console.log('[UnifiedLLM] On-device mode: using simulated generation');

      const response = await generateOnDevice(request.prompt, maxTokens);

      const duration = Date.now() - startTime;
      
      setMetrics(prev => ({
        ...prev,
        totalInferences: prev.totalInferences + 1,
        avgInferenceTime: (prev.avgInferenceTime * prev.totalInferences + duration) / (prev.totalInferences + 1),
        lastInferenceTime: duration,
      }));

      console.log(`[UnifiedLLM] Generated ${response.length} chars in ${duration}ms`);
      
      return response;
    } catch (error) {
      console.error('[UnifiedLLM] Inference error:', error);
      
      const fallbackModel = modelRegistry.current.getFallbackModel();
      if (fallbackModel && fallbackModel.id !== model.id) {
        console.log(`[UnifiedLLM] Attempting fallback to ${fallbackModel.name}`);
        try {
          const response = await generateOnDevice(request.prompt, request.maxTokens || 100);
          return response;
        } catch (fallbackError) {
          console.error('[UnifiedLLM] Fallback failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      throw error;
    } finally {
      inferenceInProgress.current = false;
      endOp();
    }
  }, [instrumentation]);

  const embed = useCallback(async (request: EmbeddingRequest): Promise<number[]> => {
    if (embeddingInProgress.current) {
      console.warn('[UnifiedLLM] Embedding already in progress, queueing...');
      await new Promise(resolve => setTimeout(resolve, 50));
      return embed(request);
    }

    const model = modelRegistry.current.getEmbeddingModel();
    if (!model) {
      throw new Error('No embedding model configured');
    }

    const endOp = instrumentation.startOperation('unified-llm', 'embed', { modelId: model.modelId });
    embeddingInProgress.current = true;
    const startTime = Date.now();

    try {
      console.log(`[UnifiedLLM] Embedding with ${model.name}`);
      
      const embedding = generateMockEmbedding(request.text);
      
      const duration = Date.now() - startTime;
      
      setMetrics(prev => ({
        ...prev,
        totalEmbeddings: prev.totalEmbeddings + 1,
        avgEmbeddingTime: (prev.avgEmbeddingTime * prev.totalEmbeddings + duration) / (prev.totalEmbeddings + 1),
      }));

      console.log(`[UnifiedLLM] Generated embedding (${embedding.length}D) in ${duration}ms`);
      
      return embedding;
    } catch (error) {
      console.error('[UnifiedLLM] Embedding error:', error);
      throw error;
    } finally {
      embeddingInProgress.current = false;
      endOp();
    }
  }, [instrumentation]);

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

  const getCapableModels = useCallback((capability: keyof ModelConfig['capabilities']) => {
    return modelRegistry.current.getModelsByCapability(capability);
  }, []);

  const generateOnDevice = async (prompt: string, maxTokens: number): Promise<string> => {
    console.log('[UnifiedLLM] Using on-device generation (simulated)');
    
    const responses = [
      `Based on your input: "${prompt.substring(0, 50)}...", I understand you're looking for insights. This is an on-device simulation. In production, this would use local CoreML models for true offline inference.`,
      `I've processed your query offline. The prompt relates to: ${prompt.split(' ').slice(0, 5).join(' ')}... On-device AI is analyzing this now.`,
      `On-device response: Your query about "${prompt.substring(0, 40)}" has been processed locally. This demonstrates offline AI capability.`,
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const setEmbeddingModel = useCallback(async (modelId: string): Promise<boolean> => {
    const success = modelRegistry.current.setEmbeddingModel(modelId);
    if (success) {
      await saveConfig();
    }
    return success;
  }, [saveConfig]);

  const setFallbackModel = useCallback(async (modelId: string): Promise<boolean> => {
    const success = modelRegistry.current.setFallbackModel(modelId);
    if (success) {
      await saveConfig();
    }
    return success;
  }, [saveConfig]);

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
