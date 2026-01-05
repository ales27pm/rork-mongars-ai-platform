import type { CuriosityState, ExplorationEvent } from '@/types/affective';
import { cosineSimilarity, generateMockEmbedding } from './embedding';

export class CuriosityEngine {
  private state: CuriosityState;
  private noveltyThreshold: number = 0.6;
  private explorationDecayRate: number = 0.95;

  constructor() {
    this.state = {
      explorationDrive: 0.5,
      uncertaintyLevel: 0.5,
      noveltyDetection: 0,
      meaningPatterns: new Map(),
      explorationHistory: [],
    };
  }

  public getState(): CuriosityState {
    return { ...this.state };
  }

  public detectNovelty(input: string, recentContext: string[]): number {
    if (recentContext.length === 0) {
      console.log('[CuriosityEngine] No context - high novelty assumed');
      return 0.9;
    }

    const inputEmbedding = generateMockEmbedding(input);
    const contextEmbeddings = recentContext.map(c => generateMockEmbedding(c));

    const similarities = contextEmbeddings.map(ce => cosineSimilarity(inputEmbedding, ce));
    const maxSimilarity = Math.max(...similarities);

    const novelty = 1 - maxSimilarity;
    
    console.log('[CuriosityEngine] Novelty detected:', novelty.toFixed(3), 'max_similarity:', maxSimilarity.toFixed(3));
    
    return novelty;
  }

  public evaluateUncertainty(
    query: string,
    availableContext: string[],
    confidence: number
  ): number {
    const contextCoverage = availableContext.length > 0 ? Math.min(1, availableContext.length / 10) : 0;
    
    const semanticUncertainty = query.includes('?') ? 0.3 : 0.1;
    
    const confidenceUncertainty = 1 - confidence;

    const uncertainty = (
      0.4 * confidenceUncertainty +
      0.3 * (1 - contextCoverage) +
      0.3 * semanticUncertainty
    );

    console.log('[CuriosityEngine] Uncertainty evaluation:', {
      total: uncertainty.toFixed(3),
      confidence_gap: confidenceUncertainty.toFixed(3),
      context_gap: (1 - contextCoverage).toFixed(3),
      semantic: semanticUncertainty.toFixed(3),
    });

    return uncertainty;
  }

  public discoverMeaningPatterns(
    input: string,
    response: string,
    confidence: number
  ): string[] {
    const discovered: string[] = [];
    
    const causalPatterns = this.extractCausalPatterns(input, response);
    if (causalPatterns.length > 0) {
      discovered.push(...causalPatterns);
      causalPatterns.forEach(p => {
        const current = this.state.meaningPatterns.get(p) || 0;
        this.state.meaningPatterns.set(p, current + confidence);
      });
    }

    const conceptualLinks = this.extractConceptualLinks(input, response);
    if (conceptualLinks.length > 0) {
      discovered.push(...conceptualLinks);
      conceptualLinks.forEach(l => {
        const current = this.state.meaningPatterns.get(l) || 0;
        this.state.meaningPatterns.set(l, current + confidence * 0.8);
      });
    }

    console.log('[CuriosityEngine] Meaning patterns discovered:', discovered.length);
    
    return discovered;
  }

  private extractCausalPatterns(input: string, response: string): string[] {
    const patterns: string[] = [];
    
    if (input.toLowerCase().includes('why') && response.toLowerCase().includes('because')) {
      patterns.push('causal:why->because');
    }
    
    if (input.toLowerCase().includes('how') && response.toLowerCase().includes('by')) {
      patterns.push('procedural:how->by');
    }

    if (input.toLowerCase().includes('what') && response.toLowerCase().includes('is')) {
      patterns.push('definitional:what->is');
    }

    return patterns;
  }

  private extractConceptualLinks(input: string, response: string): string[] {
    const links: string[] = [];
    
    const inputWords = input.toLowerCase().split(/\s+/);
    const responseWords = response.toLowerCase().split(/\s+/);
    
    const commonWords = inputWords.filter(w => 
      w.length > 4 && responseWords.includes(w)
    );
    
    if (commonWords.length > 2) {
      links.push(`semantic-bridge:${commonWords.slice(0, 2).join('_')}`);
    }

    return links;
  }

  public updateExplorationDrive(
    novelty: number,
    uncertaintyReduction: number,
    meaningDiscovered: string[]
  ): void {
    const noveltyBoost = novelty > this.noveltyThreshold ? 0.1 : -0.05;
    const uncertaintyPressure = uncertaintyReduction > 0.2 ? 0.05 : 0;
    const meaningReward = meaningDiscovered.length * 0.02;

    const delta = noveltyBoost + uncertaintyPressure + meaningReward;
    
    this.state.explorationDrive = Math.max(0, Math.min(1, 
      this.state.explorationDrive * this.explorationDecayRate + delta
    ));

    console.log('[CuriosityEngine] Exploration drive updated:', 
      this.state.explorationDrive.toFixed(3), 
      'delta:', delta.toFixed(3)
    );
  }

  public recordExploration(
    context: string,
    novelty: number,
    uncertaintyReduction: number,
    meaningDiscovered: string[]
  ): void {
    const event: ExplorationEvent = {
      timestamp: Date.now(),
      context,
      novelty,
      uncertaintyReduction,
      meaningDiscovered,
    };

    this.state.explorationHistory.push(event);
    
    if (this.state.explorationHistory.length > 100) {
      this.state.explorationHistory = this.state.explorationHistory.slice(-100);
    }

    this.state.noveltyDetection = novelty;
    this.state.uncertaintyLevel = Math.max(0, this.state.uncertaintyLevel - uncertaintyReduction);
    
    console.log('[CuriosityEngine] Exploration recorded:', {
      novelty: novelty.toFixed(3),
      uncertainty_level: this.state.uncertaintyLevel.toFixed(3),
      patterns_known: this.state.meaningPatterns.size,
    });
  }

  public shouldExplore(): boolean {
    return this.state.explorationDrive > 0.5 && this.state.uncertaintyLevel > 0.3;
  }

  public getExplorationMetrics() {
    return {
      drive: this.state.explorationDrive,
      uncertainty: this.state.uncertaintyLevel,
      novelty: this.state.noveltyDetection,
      patternsLearned: this.state.meaningPatterns.size,
      explorationEvents: this.state.explorationHistory.length,
    };
  }

  public getMeaningPatterns(): Map<string, number> {
    return new Map(this.state.meaningPatterns);
  }

  public getRecentExplorations(count: number = 10): ExplorationEvent[] {
    return this.state.explorationHistory.slice(-count);
  }
}
