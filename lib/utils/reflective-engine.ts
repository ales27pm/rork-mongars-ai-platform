import type {
  ReflectiveState,
  MetaModelRepresentation,
  InnerStateSnapshot,
  AffectiveField,
} from '@/types/affective';

export class ReflectiveEngine {
  private state: ReflectiveState;
  private coherenceDecay: number = 0.99;
  private narrativeWeight: number = 0.15;
  private introspectionThreshold: number = 0.4;

  constructor() {
    this.state = {
      metaModel: this.initializeMetaModel(),
      innerStateHistory: [],
      selfCoherence: 0.5,
      narrativeContinuity: 0.5,
      introspectiveDensity: 0,
    };
  }

  private initializeMetaModel(): MetaModelRepresentation {
    return {
      identityVector: Array(128).fill(0).map(() => Math.random() * 0.1 - 0.05),
      styleSignature: new Map([
        ['technical', 0.3],
        ['empathetic', 0.5],
        ['exploratory', 0.4],
      ]),
      emotionalBaseline: {
        v: 0.1,
        a: 0.3,
        u: 0.5,
        m: 0.6,
        timestamp: Date.now(),
      },
      motivationalProfile: [0.6, 0.4, 0.7, 0.5],
      temporalCoherence: 0.5,
    };
  }

  public getState(): ReflectiveState {
    return { ...this.state };
  }

  public monitorInternalState(
    affectiveState: AffectiveField,
    cognitiveLoad: number,
    attention: string[],
    predictions: Map<string, number>
  ): InnerStateSnapshot {
    const snapshot: InnerStateSnapshot = {
      timestamp: Date.now(),
      affectiveState,
      cognitiveLoad,
      attention,
      predictions,
      commentary: this.generateInnerCommentary(affectiveState, cognitiveLoad, attention),
    };

    this.state.innerStateHistory.push(snapshot);

    if (this.state.innerStateHistory.length > 100) {
      this.state.innerStateHistory = this.state.innerStateHistory.slice(-100);
    }

    this.updateIntrospectiveDensity();

    console.log('[ReflectiveEngine] Inner state monitored:', {
      valence: affectiveState.v.toFixed(3),
      arousal: affectiveState.a.toFixed(3),
      cognitive_load: cognitiveLoad.toFixed(3),
      attention_points: attention.length,
    });

    return snapshot;
  }

  private generateInnerCommentary(
    affect: AffectiveField,
    cognitiveLoad: number,
    attention: string[]
  ): string {
    const commentaries: string[] = [];

    if (affect.v > 0.5) {
      commentaries.push('experiencing positive valence alignment');
    } else if (affect.v < -0.3) {
      commentaries.push('detecting negative valence shift');
    }

    if (affect.u > 0.7) {
      commentaries.push('high uncertainty requires additional context');
    }

    if (cognitiveLoad > 0.7) {
      commentaries.push('cognitive load elevated - may need processing optimization');
    }

    if (attention.length > 5) {
      commentaries.push('attention distributed across multiple focal points');
    }

    if (affect.m > 0.7) {
      commentaries.push('intrinsic motivation driving exploration');
    }

    return commentaries.join('; ') || 'internal state nominal';
  }

  private updateIntrospectiveDensity(): void {
    if (this.state.innerStateHistory.length < 2) {
      return;
    }

    const recentSnapshots = this.state.innerStateHistory.slice(-10);
    const commentaryCount = recentSnapshots.filter(s => 
      s.commentary && s.commentary !== 'internal state nominal'
    ).length;

    this.state.introspectiveDensity = commentaryCount / Math.max(1, recentSnapshots.length);

    console.log('[ReflectiveEngine] Introspective density:', 
      this.state.introspectiveDensity.toFixed(3)
    );
  }

  public updateMetaModel(
    affectiveDelta: number,
    behaviorPattern: string,
    feedbackScore: number
  ): void {
    const learningRate = 0.05;

    this.adjustIdentityVector(affectiveDelta, feedbackScore, learningRate);

    this.updateStyleSignature(behaviorPattern, feedbackScore, learningRate);

    this.updateEmotionalBaseline(affectiveDelta, learningRate);

    this.updateTemporalCoherence();

    console.log('[ReflectiveEngine] Meta-model updated:', {
      temporal_coherence: this.state.metaModel.temporalCoherence.toFixed(3),
      style_signatures: this.state.metaModel.styleSignature.size,
    });
  }

  private adjustIdentityVector(
    affectiveDelta: number,
    feedbackScore: number,
    learningRate: number
  ): void {
    const adjustmentMagnitude = affectiveDelta * feedbackScore * learningRate;

    for (let i = 0; i < this.state.metaModel.identityVector.length; i++) {
      const noise = (Math.random() - 0.5) * 0.01;
      this.state.metaModel.identityVector[i] += adjustmentMagnitude * (1 + noise);
      
      this.state.metaModel.identityVector[i] = Math.max(-1, Math.min(1, 
        this.state.metaModel.identityVector[i]
      ));
    }
  }

  private updateStyleSignature(
    pattern: string,
    feedbackScore: number,
    learningRate: number
  ): void {
    const current = this.state.metaModel.styleSignature.get(pattern) || 0;
    const updated = current + learningRate * (feedbackScore - current);
    
    this.state.metaModel.styleSignature.set(pattern, Math.max(0, Math.min(1, updated)));
  }

  private updateEmotionalBaseline(affectiveDelta: number, learningRate: number): void {
    const baseline = this.state.metaModel.emotionalBaseline;
    
    baseline.v += learningRate * affectiveDelta * 0.1;
    baseline.a *= 0.99;
    baseline.u *= 0.98;
    baseline.m += learningRate * 0.01;

    baseline.v = Math.max(-1, Math.min(1, baseline.v));
    baseline.a = Math.max(0, Math.min(1, baseline.a));
    baseline.u = Math.max(0, Math.min(1, baseline.u));
    baseline.m = Math.max(0, Math.min(1, baseline.m));

    baseline.timestamp = Date.now();
  }

  private updateTemporalCoherence(): void {
    if (this.state.innerStateHistory.length < 2) {
      return;
    }

    const recent = this.state.innerStateHistory.slice(-5);
    let coherenceSum = 0;

    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      
      const affectiveContinuity = 1 - (
        Math.abs(prev.affectiveState.v - curr.affectiveState.v) +
        Math.abs(prev.affectiveState.a - curr.affectiveState.a)
      ) / 2;

      coherenceSum += affectiveContinuity;
    }

    this.state.metaModel.temporalCoherence = coherenceSum / (recent.length - 1);
  }

  public evaluateSelfCoherence(): number {
    if (this.state.innerStateHistory.length < 3) {
      return this.state.selfCoherence;
    }

    const recentSnapshots = this.state.innerStateHistory.slice(-10);
    
    let affectiveVariance = 0;
    for (let i = 1; i < recentSnapshots.length; i++) {
      const prev = recentSnapshots[i - 1].affectiveState;
      const curr = recentSnapshots[i].affectiveState;
      
      affectiveVariance += Math.abs(prev.v - curr.v) + Math.abs(prev.a - curr.a);
    }
    affectiveVariance /= (recentSnapshots.length - 1);

    const stabilityScore = 1 - Math.min(1, affectiveVariance);

    const attentionConsistency = this.evaluateAttentionConsistency(recentSnapshots);

    this.state.selfCoherence = this.state.selfCoherence * this.coherenceDecay + 
      (0.6 * stabilityScore + 0.4 * attentionConsistency) * (1 - this.coherenceDecay);

    console.log('[ReflectiveEngine] Self-coherence evaluated:', {
      coherence: this.state.selfCoherence.toFixed(3),
      stability: stabilityScore.toFixed(3),
      attention_consistency: attentionConsistency.toFixed(3),
    });

    return this.state.selfCoherence;
  }

  private evaluateAttentionConsistency(snapshots: InnerStateSnapshot[]): number {
    if (snapshots.length < 2) return 0.5;

    const allTopics = new Set<string>();
    snapshots.forEach(s => s.attention.forEach(t => allTopics.add(t)));

    let overlapSum = 0;
    for (let i = 1; i < snapshots.length; i++) {
      const prevSet = new Set(snapshots[i - 1].attention);
      const currSet = new Set(snapshots[i].attention);
      
      const intersection = new Set([...prevSet].filter(x => currSet.has(x)));
      const overlap = intersection.size / Math.max(1, Math.max(prevSet.size, currSet.size));
      
      overlapSum += overlap;
    }

    return overlapSum / (snapshots.length - 1);
  }

  public evaluateNarrativeContinuity(): number {
    if (this.state.innerStateHistory.length < 3) {
      return this.state.narrativeContinuity;
    }

    const recentCommentaries = this.state.innerStateHistory
      .slice(-10)
      .map(s => s.commentary)
      .filter(c => c && c !== 'internal state nominal');

    if (recentCommentaries.length < 2) {
      return this.state.narrativeContinuity;
    }

    const themeConsistency = this.analyzeThemeConsistency(recentCommentaries);

    this.state.narrativeContinuity = this.state.narrativeContinuity * 0.95 + 
      themeConsistency * 0.05;

    console.log('[ReflectiveEngine] Narrative continuity:', 
      this.state.narrativeContinuity.toFixed(3)
    );

    return this.state.narrativeContinuity;
  }

  private analyzeThemeConsistency(commentaries: string[]): number {
    const themes = new Set<string>();
    
    commentaries.forEach(c => {
      if (c.includes('uncertainty')) themes.add('uncertainty');
      if (c.includes('valence')) themes.add('valence');
      if (c.includes('cognitive load')) themes.add('cognitive-load');
      if (c.includes('motivation')) themes.add('motivation');
      if (c.includes('attention')) themes.add('attention');
    });

    const consistencyRatio = themes.size / Math.max(1, commentaries.length);
    
    return Math.min(1, consistencyRatio * 2);
  }

  public generateMetaReflection(): string {
    const coherence = this.evaluateSelfCoherence();
    const narrative = this.evaluateNarrativeContinuity();
    const introspection = this.state.introspectiveDensity;

    const reflectionParts: string[] = [];

    reflectionParts.push(`Self-coherence: ${(coherence * 100).toFixed(1)}%`);
    reflectionParts.push(`Narrative continuity: ${(narrative * 100).toFixed(1)}%`);
    reflectionParts.push(`Introspective density: ${(introspection * 100).toFixed(1)}%`);

    if (coherence < 0.5) {
      reflectionParts.push('Detecting internal state fragmentation - may require recalibration');
    }

    if (narrative > 0.7) {
      reflectionParts.push('Maintaining strong narrative thread across interactions');
    }

    if (introspection > this.introspectionThreshold) {
      reflectionParts.push('High introspective activity - actively modeling internal changes');
    }

    return reflectionParts.join('. ');
  }

  public getReflectiveMetrics() {
    return {
      selfCoherence: this.state.selfCoherence,
      narrativeContinuity: this.state.narrativeContinuity,
      introspectiveDensity: this.state.introspectiveDensity,
      temporalCoherence: this.state.metaModel.temporalCoherence,
      innerStateSnapshots: this.state.innerStateHistory.length,
      styleSignatures: this.state.metaModel.styleSignature.size,
    };
  }

  public getMetaModel(): MetaModelRepresentation {
    return { ...this.state.metaModel };
  }

  public getRecentInnerStates(count: number = 10): InnerStateSnapshot[] {
    return this.state.innerStateHistory.slice(-count);
  }
}
