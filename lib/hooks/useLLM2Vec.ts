import { useState, useCallback, useEffect, useRef } from 'react';
import { dolphinCoreML, ModelConfig, EncodingOptions, GenerationParameters, PerformanceMetrics } from '@/lib/modules/DolphinCoreML';

export interface UseLLM2VecOptions {
  autoInitialize?: boolean;
  modelConfig?: ModelConfig;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export function useLLM2Vec(options: UseLLM2VecOptions = {}) {
  const {
    autoInitialize = true,
    modelConfig = {},
    onReady,
    onError
  } = options;
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const initializedRef = useRef(false);
  
  const initialize = useCallback(async (config?: ModelConfig) => {
    if (initializedRef.current) return true;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await dolphinCoreML.initialize({
        ...modelConfig,
        ...config
      });
      
      if (result.success) {
        setIsInitialized(true);
        initializedRef.current = true;
        onReady?.();
        
        console.log('[useLLM2Vec] Initialized successfully:', result.metadata);
        console.log('[useLLM2Vec] Device info:', result.deviceInfo);
        
        return true;
      } else {
        throw new Error('Failed to initialize model');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      console.error('[useLLM2Vec] Initialization error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [modelConfig, onReady, onError]);
  
  const encode = useCallback(async (text: string, options?: EncodingOptions) => {
    if (!initializedRef.current) {
      throw new Error('Model not initialized. Call initialize() first.');
    }
    
    try {
      const startTime = Date.now();
      const embedding = await dolphinCoreML.encode(text, options);
      const duration = Date.now() - startTime;
      
      console.log(`[useLLM2Vec] Encoded text (${text.length} chars) in ${duration}ms`);
      
      return embedding;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    }
  }, [onError]);
  
  const encodeBatch = useCallback(async (texts: string[], options?: EncodingOptions) => {
    if (!initializedRef.current) {
      throw new Error('Model not initialized. Call initialize() first.');
    }
    
    try {
      const startTime = Date.now();
      const embeddings = await dolphinCoreML.encodeBatch(texts, options);
      const duration = Date.now() - startTime;
      
      console.log(`[useLLM2Vec] Encoded ${texts.length} texts in ${duration}ms (${(duration / texts.length).toFixed(2)}ms per text)`);
      
      return embeddings;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    }
  }, [onError]);
  
  const generate = useCallback(async (prompt: string, params?: GenerationParameters) => {
    if (!initializedRef.current) {
      throw new Error('Model not initialized. Call initialize() first.');
    }
    
    try {
      const startTime = Date.now();
      const result = await dolphinCoreML.generate(prompt, params);
      const duration = Date.now() - startTime;
      
      console.log(`[useLLM2Vec] Generated response in ${duration}ms`);
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    }
  }, [onError]);
  
  const getMetrics = useCallback(async () => {
    try {
      const performanceMetrics = await dolphinCoreML.getMetrics();
      setMetrics(performanceMetrics);
      return performanceMetrics;
    } catch (err) {
      console.error('[useLLM2Vec] Failed to get metrics:', err);
      return null;
    }
  }, []);
  
  const refreshMetrics = useCallback(async () => {
    await getMetrics();
  }, [getMetrics]);
  
  useEffect(() => {
    if (autoInitialize && !initializedRef.current) {
      initialize();
    }
  }, [autoInitialize, initialize]);
  
  return {
    isInitialized,
    isLoading,
    error,
    metrics,
    initialize,
    encode,
    encodeBatch,
    generate,
    getMetrics,
    refreshMetrics
  };
}
