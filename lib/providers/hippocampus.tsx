import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MemoryEntry, Message } from '@/types';
import type { AffectiveField } from '@/types/affective';
import { cosineSimilarity, generateMockEmbedding, generateRealEmbedding } from '@/lib/utils/embedding';
import { useInstrumentation } from './instrumentation';
import { MemorySynthesisEngine, type MemorySynthesisResult } from '@/lib/utils/memory-synthesis';

const STORAGE_KEY = 'mongars_memory';
const SHORT_TERM_MAX = 100;
const TTL_MS = 24 * 60 * 60 * 1000;
const FLUSH_INTERVAL_MS = 30000;

export const [HippocampusProvider, useHippocampus] = createContextHook(() => {
  const instrumentation = useInstrumentation();
  const [shortTermMemory, setShortTermMemory] = useState<Message[]>([]);
  const [longTermMemory, setLongTermMemory] = useState<MemoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [memorySynthesis, setMemorySynthesis] = useState<MemorySynthesisResult | null>(null);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const synthesisEngine = useRef(new MemorySynthesisEngine());

  const loadMemory = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setLongTermMemory(parsed.longTerm || []);
        setShortTermMemory(parsed.shortTerm || []);
      }
    } catch (error) {
      console.error('[Hippocampus] Load error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const flushMemory = useCallback(async () => {
    try {
      const now = Date.now();
      const validMemories = longTermMemory.filter(m => m.expiresAt > now);
      
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        longTerm: validMemories,
        shortTerm: shortTermMemory.slice(-SHORT_TERM_MAX),
      }));
      
      console.log(`[Hippocampus] Flushed ${validMemories.length} long-term, ${shortTermMemory.length} short-term`);
    } catch (error) {
      console.error('[Hippocampus] Flush error:', error);
    }
  }, [longTermMemory, shortTermMemory]);

  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  useEffect(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }
    
    flushTimeoutRef.current = setTimeout(() => {
      flushMemory();
    }, FLUSH_INTERVAL_MS);

    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, [flushMemory]);

  const storeMessage = useCallback(async (message: Message) => {
    const endOp = instrumentation.startOperation('memory', 'store-message', { role: message.role });
    
    setShortTermMemory(prev => {
      const updated = [...prev, message];
      if (updated.length > SHORT_TERM_MAX) {
        const consolidated = updated.slice(0, updated.length - SHORT_TERM_MAX);
        
        consolidated.forEach(async msg => {
          if (msg.role === 'assistant' && msg.confidence && msg.confidence > 0.75) {
            const embedding = msg.embedding || await generateRealEmbedding(msg.content).catch(() => generateMockEmbedding(msg.content));
            const entry: MemoryEntry = {
              id: msg.id,
              userId: 'default',
              content: msg.content,
              embedding,
              timestamp: msg.timestamp,
              expiresAt: Date.now() + TTL_MS,
              importance: msg.confidence,
              accessCount: 0,
            };
            setLongTermMemory(prev => [...prev, entry]);
          }
        });
        
        return updated.slice(-SHORT_TERM_MAX);
      }
      return updated;
    });

    if (message.role === 'assistant' && message.confidence && message.confidence > 0.85) {
      const embedding = message.embedding || await generateRealEmbedding(message.content).catch(() => generateMockEmbedding(message.content));
      const entry: MemoryEntry = {
        id: message.id,
        userId: 'default',
        content: message.content,
        embedding,
        timestamp: message.timestamp,
        expiresAt: Date.now() + TTL_MS,
        importance: message.confidence,
        accessCount: 0,
      };

      setLongTermMemory(prev => {
        const exists = prev.some(e => e.id === entry.id);
        if (exists) return prev;
        return [...prev, entry];
      });
    }
    
    endOp();
  }, [instrumentation]);

  const vectorSearch = useCallback((query: string, topK: number = 3): MemoryEntry[] => {
    const endOp = instrumentation.startOperation('memory', 'vector-search', { topK });
    
    const queryEmbedding = generateMockEmbedding(query);
    const now = Date.now();
    
    const validMemories = longTermMemory.filter(m => m.expiresAt > now);
    
    if (validMemories.length === 0) return [];
    
    const scored = validMemories.map(entry => {
      const semanticScore = cosineSimilarity(queryEmbedding, entry.embedding);
      const recencyScore = 1 - ((now - entry.timestamp) / TTL_MS);
      const importanceScore = entry.importance;
      const accessScore = Math.min(1, entry.accessCount / 10);
      
      const finalScore = (
        semanticScore * 0.5 +
        recencyScore * 0.2 +
        importanceScore * 0.2 +
        accessScore * 0.1
      );
      
      return { entry, score: finalScore, semanticScore };
    });

    scored.sort((a, b) => b.score - a.score);
    
    const results = scored.slice(0, topK);
    
    results.forEach(s => {
      setLongTermMemory(prev => prev.map(m => 
        m.id === s.entry.id ? { ...m, accessCount: m.accessCount + 1 } : m
      ));
    });
    
    console.log(`[Hippocampus] Vector search: ${results.length} results, top score: ${results[0]?.score.toFixed(3)} (semantic: ${results[0]?.semanticScore.toFixed(3)})`);
    
    endOp();
    return results.map(s => s.entry);
  }, [longTermMemory, instrumentation]);

  const pruneMemory = useCallback(() => {
    const now = Date.now();
    setLongTermMemory(prev => prev.filter(m => m.expiresAt > now));
    console.log('[Hippocampus] Pruned expired memories');
  }, []);

  const getStats = useCallback(() => {
    return {
      shortTermCount: shortTermMemory.length,
      longTermCount: longTermMemory.filter(m => m.expiresAt > Date.now()).length,
      totalCount: shortTermMemory.length + longTermMemory.length,
      oldestTimestamp: longTermMemory.length > 0 
        ? Math.min(...longTermMemory.map(m => m.timestamp))
        : null,
    };
  }, [shortTermMemory, longTermMemory]);

  const synthesizeMemories = useCallback(async (currentAffect: AffectiveField) => {
    console.log('[Hippocampus] Synthesizing memories...');
    
    try {
      const result = await synthesisEngine.current.synthesizeFromMemories(
        longTermMemory,
        shortTermMemory,
        currentAffect
      );
      
      setMemorySynthesis(result);
      
      console.log('[Hippocampus] Synthesis complete:', {
        narratives: result.narratives.length,
        clusters: result.clusters.length,
        identityCoherence: result.identityCoherence.toFixed(3),
        affectiveConsistency: result.affectiveConsistency.toFixed(3),
        temporalContinuity: result.temporalContinuity.toFixed(3),
      });
      
      return result;
    } catch (error) {
      console.error('[Hippocampus] Synthesis failed:', error);
      return null;
    }
  }, [longTermMemory, shortTermMemory]);

  const getNarratives = useCallback(() => {
    return synthesisEngine.current.getNarratives();
  }, []);

  const getClusters = useCallback(() => {
    return synthesisEngine.current.getClusters();
  }, []);

  return {
    shortTermMemory,
    longTermMemory,
    isLoading,
    memorySynthesis,
    storeMessage,
    vectorSearch,
    pruneMemory,
    flushMemory,
    getStats,
    synthesizeMemories,
    getNarratives,
    getClusters,
  };
});
