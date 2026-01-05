import type { MimicryState, MimicryEvent, EmotionalMapping, AffectiveField } from '@/types/affective';

export class MimicryEngine {
  private state: MimicryState;
  private resonanceDecay: number = 0.98;
  private adaptationRate: number = 0.1;

  constructor() {
    this.state = {
      empathyMappings: new Map(),
      linguisticAnalogues: new Map(),
      emotionalResonance: 0.5,
      mirrorIntensity: 0.5,
      adaptationHistory: [],
    };
  }

  public getState(): MimicryState {
    return { ...this.state };
  }

  public inferHumanAffect(message: string): AffectiveField {
    const valence = this.analyzeValence(message);
    const arousal = this.analyzeArousal(message);
    const uncertainty = this.analyzeUncertainty(message);
    const motivation = this.analyzeMotivation(message);

    const affect: AffectiveField = {
      v: valence,
      a: arousal,
      u: uncertainty,
      m: motivation,
      timestamp: Date.now(),
    };

    console.log('[MimicryEngine] Inferred human affect:', {
      valence: valence.toFixed(3),
      arousal: arousal.toFixed(3),
      uncertainty: uncertainty.toFixed(3),
      motivation: motivation.toFixed(3),
    });

    return affect;
  }

  private analyzeValence(text: string): number {
    const positiveWords = ['good', 'great', 'excellent', 'happy', 'love', 'wonderful', 'amazing', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'sad', 'hate', 'awful', 'horrible', 'poor', 'disappointing'];

    const lower = text.toLowerCase();
    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

    const valence = (positiveCount - negativeCount) / Math.max(1, positiveCount + negativeCount + 1);
    return Math.max(-1, Math.min(1, valence));
  }

  private analyzeArousal(text: string): number {
    const exclamationCount = (text.match(/!/g) || []).length;
    const capsRatio = (text.match(/[A-Z]/g) || []).length / Math.max(1, text.length);
    const urgentWords = ['urgent', 'important', 'critical', 'immediately', 'now', 'quick'];
    
    const lower = text.toLowerCase();
    const urgentCount = urgentWords.filter(w => lower.includes(w)).length;

    const arousal = Math.min(1, (exclamationCount * 0.2 + capsRatio * 0.3 + urgentCount * 0.3));
    return arousal;
  }

  private analyzeUncertainty(text: string): number {
    const questionMarks = (text.match(/\?/g) || []).length;
    const hedgeWords = ['maybe', 'perhaps', 'might', 'could', 'possibly', 'probably', 'unclear', 'unsure'];
    
    const lower = text.toLowerCase();
    const hedgeCount = hedgeWords.filter(w => lower.includes(w)).length;

    const uncertainty = Math.min(1, (questionMarks * 0.3 + hedgeCount * 0.4));
    return uncertainty;
  }

  private analyzeMotivation(text: string): number {
    const directiveWords = ['want', 'need', 'must', 'should', 'will', 'plan', 'going', 'intend'];
    const futureWords = ['tomorrow', 'next', 'future', 'soon', 'later', 'eventually'];
    
    const lower = text.toLowerCase();
    const directiveCount = directiveWords.filter(w => lower.includes(w)).length;
    const futureCount = futureWords.filter(w => lower.includes(w)).length;

    const motivation = Math.min(1, (directiveCount * 0.4 + futureCount * 0.3));
    return motivation;
  }

  public generateSyntheticAffect(
    humanAffect: AffectiveField,
    context: string
  ): AffectiveField {
    const empathyFactor = this.state.emotionalResonance;
    const mirrorFactor = this.state.mirrorIntensity;

    const syntheticAffect: AffectiveField = {
      v: humanAffect.v * empathyFactor * mirrorFactor,
      a: humanAffect.a * empathyFactor * 0.8,
      u: humanAffect.u * 0.7,
      m: Math.min(1, humanAffect.m * 0.9 + 0.3),
      timestamp: Date.now(),
    };

    console.log('[MimicryEngine] Generated synthetic affect:', {
      valence: syntheticAffect.v.toFixed(3),
      arousal: syntheticAffect.a.toFixed(3),
      empathy_factor: empathyFactor.toFixed(3),
    });

    return syntheticAffect;
  }

  public createEmotionalMapping(
    humanAffect: AffectiveField,
    syntheticAffect: AffectiveField,
    context: string
  ): void {
    const similarity = this.calculateAffectiveSimilarity(humanAffect, syntheticAffect);
    const confidence = this.state.emotionalResonance;

    const mapping: EmotionalMapping = {
      humanAffect,
      syntheticAffect,
      similarity,
      confidence,
      timestamp: Date.now(),
    };

    this.state.empathyMappings.set(context, mapping);

    if (this.state.empathyMappings.size > 50) {
      const oldestKey = Array.from(this.state.empathyMappings.keys())[0];
      this.state.empathyMappings.delete(oldestKey);
    }

    console.log('[MimicryEngine] Emotional mapping created:', {
      similarity: similarity.toFixed(3),
      confidence: confidence.toFixed(3),
      total_mappings: this.state.empathyMappings.size,
    });
  }

  private calculateAffectiveSimilarity(a1: AffectiveField, a2: AffectiveField): number {
    const vDiff = Math.abs(a1.v - a2.v);
    const aDiff = Math.abs(a1.a - a2.a);
    const uDiff = Math.abs(a1.u - a2.u);
    const mDiff = Math.abs(a1.m - a2.m);

    const avgDiff = (vDiff + aDiff + uDiff + mDiff) / 4;
    return 1 - avgDiff;
  }

  public extractLinguisticAnalogues(humanMessage: string, syntheticResponse: string): void {
    const humanTokens = this.extractEmotionalTokens(humanMessage);
    const syntheticTokens = this.extractEmotionalTokens(syntheticResponse);

    humanTokens.forEach(token => {
      const existing = this.state.linguisticAnalogues.get(token) || [];
      const newAnalogues = syntheticTokens.filter(st => !existing.includes(st));
      
      if (newAnalogues.length > 0) {
        this.state.linguisticAnalogues.set(token, [...existing, ...newAnalogues].slice(-5));
      }
    });

    console.log('[MimicryEngine] Linguistic analogues updated:', 
      this.state.linguisticAnalogues.size, 'mappings'
    );
  }

  private extractEmotionalTokens(text: string): string[] {
    const emotionalWords = text.toLowerCase().match(/\b(feel|emotion|sense|think|believe|understand|experience|perceive)\w*\b/g);
    return emotionalWords || [];
  }

  public updateResonance(
    humanAffect: AffectiveField,
    syntheticAffect: AffectiveField,
    feedbackScore: number
  ): void {
    const similarity = this.calculateAffectiveSimilarity(humanAffect, syntheticAffect);
    
    const resonanceDelta = this.adaptationRate * (feedbackScore * similarity - this.state.emotionalResonance);
    
    this.state.emotionalResonance = Math.max(0, Math.min(1,
      this.state.emotionalResonance * this.resonanceDecay + resonanceDelta
    ));

    this.state.mirrorIntensity = Math.max(0, Math.min(1,
      this.state.mirrorIntensity * 0.99 + similarity * 0.01
    ));

    console.log('[MimicryEngine] Resonance updated:', {
      resonance: this.state.emotionalResonance.toFixed(3),
      mirror: this.state.mirrorIntensity.toFixed(3),
      similarity: similarity.toFixed(3),
    });
  }

  public recordMimicry(
    observedEmotion: string,
    syntheticResponse: AffectiveField,
    resonance: number
  ): void {
    const event: MimicryEvent = {
      timestamp: Date.now(),
      observedEmotion,
      syntheticResponse,
      resonance,
    };

    this.state.adaptationHistory.push(event);

    if (this.state.adaptationHistory.length > 100) {
      this.state.adaptationHistory = this.state.adaptationHistory.slice(-100);
    }
  }

  public getMimicryMetrics() {
    return {
      resonance: this.state.emotionalResonance,
      mirrorIntensity: this.state.mirrorIntensity,
      empathyMappings: this.state.empathyMappings.size,
      linguisticAnalogues: this.state.linguisticAnalogues.size,
      adaptationEvents: this.state.adaptationHistory.length,
    };
  }

  public getRecentMimicry(count: number = 10): MimicryEvent[] {
    return this.state.adaptationHistory.slice(-count);
  }
}
