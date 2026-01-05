import { cosineSimilarity } from './embedding';

export interface DocumentChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    source?: string;
    timestamp?: number;
    importance?: number;
  };
}

export interface RankedResult {
  chunk: DocumentChunk;
  semanticScore: number;
  bm25Score: number;
  diversityScore: number;
  finalScore: number;
}

export class AdvancedRAG {
  private readonly SEMANTIC_WEIGHT = 0.5;
  private readonly BM25_WEIGHT = 0.3;
  private readonly DIVERSITY_WEIGHT = 0.2;

  rerank(
    query: string,
    queryEmbedding: number[],
    candidates: DocumentChunk[],
    topK: number = 5
  ): RankedResult[] {
    const scoredResults: RankedResult[] = candidates.map(chunk => {
      const semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding);
      const bm25Score = this.calculateBM25(query, chunk.content);
      const diversityScore = 0;

      const finalScore =
        semanticScore * this.SEMANTIC_WEIGHT +
        bm25Score * this.BM25_WEIGHT +
        diversityScore * this.DIVERSITY_WEIGHT;

      return {
        chunk,
        semanticScore,
        bm25Score,
        diversityScore,
        finalScore,
      };
    });

    scoredResults.sort((a, b) => b.finalScore - a.finalScore);

    const reranked = this.applyMaximalMarginalRelevance(scoredResults, topK);

    console.log(`[AdvancedRAG] Re-ranked ${candidates.length} candidates to top ${topK}`);
    console.log(`[AdvancedRAG] Top result: semantic=${reranked[0]?.semanticScore.toFixed(3)}, bm25=${reranked[0]?.bm25Score.toFixed(3)}, final=${reranked[0]?.finalScore.toFixed(3)}`);

    return reranked;
  }

  private calculateBM25(query: string, document: string): number {
    const k1 = 1.5;
    const b = 0.75;
    const avgDocLength = 100;

    const queryTerms = this.tokenize(query);
    const docTerms = this.tokenize(document);
    const docLength = docTerms.length;

    let score = 0;

    for (const term of queryTerms) {
      const termFreq = docTerms.filter(t => t === term).length;
      const idf = Math.log((1 + 0.5) / (0.5 + termFreq + 1));

      const numerator = termFreq * (k1 + 1);
      const denominator = termFreq + k1 * (1 - b + b * (docLength / avgDocLength));

      score += idf * (numerator / denominator);
    }

    return Math.max(0, Math.min(1, score / queryTerms.length));
  }

  private applyMaximalMarginalRelevance(
    results: RankedResult[],
    topK: number,
    lambda: number = 0.7
  ): RankedResult[] {
    if (results.length === 0) return [];

    const selected: RankedResult[] = [results[0]];
    const remaining = results.slice(1);

    while (selected.length < topK && remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const relevance = candidate.finalScore;

        const maxSimilarity = Math.max(
          ...selected.map(s =>
            cosineSimilarity(candidate.chunk.embedding, s.chunk.embedding)
          )
        );

        const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }

      const [chosen] = remaining.splice(bestIdx, 1);
      chosen.diversityScore = 1 - Math.max(
        ...selected.map(s =>
          cosineSimilarity(chosen.chunk.embedding, s.chunk.embedding)
        )
      );
      selected.push(chosen);
    }

    return selected;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  hybridSearch(
    query: string,
    queryEmbedding: number[],
    vectorResults: DocumentChunk[],
    keywordResults: DocumentChunk[],
    topK: number = 5
  ): RankedResult[] {
    const allCandidates = new Map<string, DocumentChunk>();
    
    vectorResults.forEach(r => allCandidates.set(r.id, r));
    keywordResults.forEach(r => allCandidates.set(r.id, r));

    return this.rerank(query, queryEmbedding, Array.from(allCandidates.values()), topK);
  }
}
