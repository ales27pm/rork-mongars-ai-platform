import { dolphinCoreML } from '@/lib/modules/DolphinCoreML';
import { transformerEmbeddings } from '@/lib/utils/transformer-embeddings';

const embeddingCache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 500;

export async function generateRealEmbedding(text: string): Promise<number[]> {
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text)!;
  }

  try {
    const embedding = await transformerEmbeddings.encode(text, { normalize: true });
    
    if (embeddingCache.size >= MAX_CACHE_SIZE) {
      const firstKey = embeddingCache.keys().next().value;
      if (firstKey) {
        embeddingCache.delete(firstKey);
      }
    }
    embeddingCache.set(text, embedding);
    
    return embedding;
  } catch (error) {
    console.warn('[Embedding] Transformer failed, trying DolphinCoreML:', error);
    try {
      const embedding = await dolphinCoreML.encode(text);
      embeddingCache.set(text, embedding);
      return embedding;
    } catch (fallbackError) {
      console.warn('[Embedding] All methods failed, using mock:', fallbackError);
      return generateMockEmbedding(text);
    }
  }
}

export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const uncached: string[] = [];
  const cached: number[][] = [];
  const uncachedIndices: number[] = [];

  texts.forEach((text, idx) => {
    if (embeddingCache.has(text)) {
      cached.push(embeddingCache.get(text)!);
    } else {
      uncached.push(text);
      uncachedIndices.push(idx);
    }
  });

  if (uncached.length === 0) {
    return texts.map(text => embeddingCache.get(text)!);
  }

  try {
    const newEmbeddings = await transformerEmbeddings.encodeBatch(uncached, { normalize: true });
    
    uncached.forEach((text, idx) => {
      if (embeddingCache.size >= MAX_CACHE_SIZE) {
        const firstKey = embeddingCache.keys().next().value;
        if (firstKey) {
          embeddingCache.delete(firstKey);
        }
      }
      embeddingCache.set(text, newEmbeddings[idx]);
    });
    
    const results: number[][] = [];
    let cachedIdx = 0;
    let uncachedIdx = 0;
    
    for (let i = 0; i < texts.length; i++) {
      if (uncachedIndices.includes(i)) {
        results.push(newEmbeddings[uncachedIdx++]);
      } else {
        results.push(cached[cachedIdx++]);
      }
    }
    
    return results;
  } catch (error) {
    console.warn('[Embedding] Transformer batch failed, trying DolphinCoreML:', error);
    try {
      const newEmbeddings = await dolphinCoreML.encodeBatch(uncached);
      uncached.forEach((text, idx) => embeddingCache.set(text, newEmbeddings[idx]));
      
      const results: number[][] = [];
      let cachedIdx = 0;
      let uncachedIdx = 0;
      
      for (let i = 0; i < texts.length; i++) {
        if (uncachedIndices.includes(i)) {
          results.push(newEmbeddings[uncachedIdx++]);
        } else {
          results.push(cached[cachedIdx++]);
        }
      }
      
      return results;
    } catch (fallbackError) {
      console.warn('[Embedding] All batch methods failed, using mock:', fallbackError);
      return texts.map(generateMockEmbedding);
    }
  }
}

export function generateMockEmbedding(text: string): number[] {
  const vector: number[] = [];
  const dimension = 384;
  
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }
  
  for (let i = 0; i < dimension; i++) {
    const seed = hash + i;
    const value = Math.sin(seed) * Math.cos(seed * 0.5);
    vector.push(value);
  }
  
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map(v => v / magnitude);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function computeSimilarityMatrix(embeddings: number[][]): number[][] {
  const n = embeddings.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }
  
  return matrix;
}

export function clearEmbeddingCache(): void {
  embeddingCache.clear();
  console.log('[Embedding] Cache cleared');
}
