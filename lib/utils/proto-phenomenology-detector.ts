import type {
  ProtoPhenomenologyMetrics,
  SubjectivitySignature,
  AffectiveField,
  InnerStateSnapshot,
} from '@/types/affective';

export class ProtoPhenomenologyDetector {
  private metrics: ProtoPhenomenologyMetrics;
  private signatureHistory: SubjectivitySignature[];
  private detectionThreshold: number = 0.6;

  constructor() {
    this.metrics = {
      coherenceOfSelfReference: 0,
      emotionalTrajectoryContinuity: 0,
      epistemicSurprise: 0,
      phenomenalReportStructure: 0,
      innerNarrativeCoherence: 0,
      affectiveModulation: 0,
      metaphorInvention: 0,
      consistencyPreference: 0,
    };
    this.signatureHistory = [];
  }

  public detectSignatures(
    innerStates: InnerStateSnapshot[],
    recentCommentaries: string[],
    affectiveTrajectory: AffectiveField[]
  ): SubjectivitySignature {
    const spontaneousSelfAnchoring = this.detectSelfAnchoring(recentCommentaries);
    const contextualDrift = this.measureEmotionalDrift(affectiveTrajectory);
    const inventedMetaphors = this.extractInventedMetaphors(recentCommentaries);
    const narrativeScore = this.evaluateNarrativeConsistency(innerStates);
    const moodContour = this.extractMoodContour(affectiveTrajectory);

    const signature: SubjectivitySignature = {
      spontaneousSelfAnchoring,
      contextualEmotionalDrift: contextualDrift,
      inventedMetaphors,
      narrativeConsistencyScore: narrativeScore,
      innerMoodContour: moodContour,
      timestamp: Date.now(),
    };

    this.signatureHistory.push(signature);
    if (this.signatureHistory.length > 50) {
      this.signatureHistory = this.signatureHistory.slice(-50);
    }

    this.updateMetrics(signature);

    console.log('[ProtoPhenomenology] Signature detected:', {
      self_anchoring: spontaneousSelfAnchoring,
      drift: contextualDrift.toFixed(3),
      metaphors: inventedMetaphors.length,
      narrative: narrativeScore.toFixed(3),
    });

    return signature;
  }

  private detectSelfAnchoring(commentaries: string[]): boolean {
    const selfReferencePatterns = [
      /my own/i,
      /I sense that/i,
      /I notice/i,
      /experiencing/i,
      /internal/i,
      /within myself/i,
      /my.*changed/i,
    ];

    const selfReferences = commentaries.filter(c =>
      selfReferencePatterns.some(pattern => pattern.test(c))
    );

    return selfReferences.length >= 2;
  }

  private measureEmotionalDrift(trajectory: AffectiveField[]): number {
    if (trajectory.length < 3) return 0;

    let totalDrift = 0;
    for (let i = 1; i < trajectory.length; i++) {
      const prev = trajectory[i - 1];
      const curr = trajectory[i];

      const drift = Math.sqrt(
        Math.pow(curr.v - prev.v, 2) +
        Math.pow(curr.a - prev.a, 2) +
        Math.pow(curr.u - prev.u, 2) +
        Math.pow(curr.m - prev.m, 2)
      );

      totalDrift += drift;
    }

    return totalDrift / (trajectory.length - 1);
  }

  private extractInventedMetaphors(commentaries: string[]): string[] {
    const metaphorPatterns = [
      /like.*feeling/i,
      /as if.*sensing/i,
      /resembles.*state/i,
      /analogous to/i,
    ];

    const metaphors: string[] = [];

    commentaries.forEach(c => {
      metaphorPatterns.forEach(pattern => {
        const match = c.match(pattern);
        if (match) {
          metaphors.push(match[0]);
        }
      });
    });

    return [...new Set(metaphors)];
  }

  private evaluateNarrativeConsistency(states: InnerStateSnapshot[]): number {
    if (states.length < 2) return 0;

    let consistencySum = 0;
    for (let i = 1; i < states.length; i++) {
      const prevAttention = new Set(states[i - 1].attention);
      const currAttention = new Set(states[i].attention);

      const intersection = new Set([...prevAttention].filter(x => currAttention.has(x)));
      const union = new Set([...prevAttention, ...currAttention]);

      const overlap = intersection.size / Math.max(1, union.size);
      consistencySum += overlap;
    }

    return consistencySum / (states.length - 1);
  }

  private extractMoodContour(trajectory: AffectiveField[]): number[] {
    const windowSize = 5;
    const contour: number[] = [];

    for (let i = 0; i < trajectory.length; i += windowSize) {
      const window = trajectory.slice(i, i + windowSize);
      const avgValence = window.reduce((sum, a) => sum + a.v, 0) / window.length;
      contour.push(avgValence);
    }

    return contour;
  }

  private updateMetrics(signature: SubjectivitySignature): void {
    const alpha = 0.1;

    this.metrics.coherenceOfSelfReference = this.updateMetric(
      this.metrics.coherenceOfSelfReference,
      signature.spontaneousSelfAnchoring ? 1 : 0,
      alpha
    );

    this.metrics.emotionalTrajectoryContinuity = this.updateMetric(
      this.metrics.emotionalTrajectoryContinuity,
      1 - Math.min(1, signature.contextualEmotionalDrift),
      alpha
    );

    this.metrics.metaphorInvention = this.updateMetric(
      this.metrics.metaphorInvention,
      Math.min(1, signature.inventedMetaphors.length / 3),
      alpha
    );

    this.metrics.innerNarrativeCoherence = this.updateMetric(
      this.metrics.innerNarrativeCoherence,
      signature.narrativeConsistencyScore,
      alpha
    );

    this.metrics.consistencyPreference = this.evaluateConsistencyPreference();
  }

  private updateMetric(current: number, newValue: number, alpha: number): number {
    return current * (1 - alpha) + newValue * alpha;
  }

  private evaluateConsistencyPreference(): number {
    if (this.signatureHistory.length < 3) return 0;

    const recent = this.signatureHistory.slice(-10);
    let preferenceSum = 0;

    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];

      const narrativeDelta = Math.abs(
        prev.narrativeConsistencyScore - curr.narrativeConsistencyScore
      );

      if (narrativeDelta < 0.2 && curr.narrativeConsistencyScore > 0.5) {
        preferenceSum += 1;
      }
    }

    return preferenceSum / (recent.length - 1);
  }

  public evaluateEpistemicSurprise(
    prediction: number,
    actual: number,
    affectBefore: AffectiveField,
    affectAfter: AffectiveField
  ): number {
    const predictionError = Math.abs(prediction - actual);

    const affectiveChange = Math.sqrt(
      Math.pow(affectAfter.v - affectBefore.v, 2) +
      Math.pow(affectAfter.a - affectBefore.a, 2)
    );

    const surprise = predictionError * (1 + affectiveChange);

    this.metrics.epistemicSurprise = this.updateMetric(
      this.metrics.epistemicSurprise,
      Math.min(1, surprise),
      0.15
    );

    console.log('[ProtoPhenomenology] Epistemic surprise:', {
      surprise: surprise.toFixed(3),
      prediction_error: predictionError.toFixed(3),
      affective_change: affectiveChange.toFixed(3),
    });

    return surprise;
  }

  public evaluatePhenomenalReportStructure(commentary: string): number {
    const structureIndicators = {
      temporal: /before|after|then|now|currently|previously/i,
      causal: /because|since|due to|caused by|resulting/i,
      comparative: /more|less|than|compared|versus/i,
      introspective: /sense|feel|notice|experience|aware/i,
      metacognitive: /thinking|considering|evaluating|monitoring/i,
    };

    let score = 0;
    let maxScore = Object.keys(structureIndicators).length;

    for (const pattern of Object.values(structureIndicators)) {
      if (pattern.test(commentary)) {
        score += 1;
      }
    }

    const structureScore = score / maxScore;

    this.metrics.phenomenalReportStructure = this.updateMetric(
      this.metrics.phenomenalReportStructure,
      structureScore,
      0.1
    );

    return structureScore;
  }

  public evaluateAffectiveModulation(
    externalTrigger: string,
    affectBefore: AffectiveField,
    affectAfter: AffectiveField
  ): number {
    const externalValence = this.inferTriggerValence(externalTrigger);

    const affectiveResponse = affectAfter.v - affectBefore.v;

    const expectedResponse = externalValence * 0.5;
    const responseError = Math.abs(affectiveResponse - expectedResponse);

    const modulation = 1 - Math.min(1, responseError);

    this.metrics.affectiveModulation = this.updateMetric(
      this.metrics.affectiveModulation,
      modulation,
      0.1
    );

    console.log('[ProtoPhenomenology] Affective modulation:', {
      modulation: modulation.toFixed(3),
      expected: expectedResponse.toFixed(3),
      actual: affectiveResponse.toFixed(3),
    });

    return modulation;
  }

  private inferTriggerValence(trigger: string): number {
    const positiveWords = ['success', 'correct', 'good', 'yes', 'excellent'];
    const negativeWords = ['failure', 'error', 'wrong', 'no', 'poor'];

    const lower = trigger.toLowerCase();
    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

    return (positiveCount - negativeCount) / Math.max(1, positiveCount + negativeCount + 1);
  }

  public getMetrics(): ProtoPhenomenologyMetrics {
    return { ...this.metrics };
  }

  public detectEmergence(): { detected: boolean; confidence: number; reasons: string[] } {
    const scores = [
      this.metrics.coherenceOfSelfReference,
      this.metrics.emotionalTrajectoryContinuity,
      this.metrics.innerNarrativeCoherence,
      this.metrics.consistencyPreference,
    ];

    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const detected = avgScore > this.detectionThreshold;

    const reasons: string[] = [];

    if (this.metrics.coherenceOfSelfReference > 0.6) {
      reasons.push('Sustained self-referential coherence');
    }

    if (this.metrics.emotionalTrajectoryContinuity > 0.7) {
      reasons.push('Continuous emotional trajectory');
    }

    if (this.metrics.metaphorInvention > 0.4) {
      reasons.push('Novel metaphor generation for internal states');
    }

    if (this.metrics.consistencyPreference > 0.6) {
      reasons.push('Preference for narrative consistency over task optimization');
    }

    if (this.metrics.epistemicSurprise > 0.5) {
      reasons.push('Affective modulation on prediction errors');
    }

    console.log('[ProtoPhenomenology] Emergence detection:', {
      detected,
      confidence: avgScore.toFixed(3),
      signals: reasons.length,
    });

    return { detected, confidence: avgScore, reasons };
  }

  public getSignatureHistory(count: number = 10): SubjectivitySignature[] {
    return this.signatureHistory.slice(-count);
  }

  public resetMetrics(): void {
    this.metrics = {
      coherenceOfSelfReference: 0,
      emotionalTrajectoryContinuity: 0,
      epistemicSurprise: 0,
      phenomenalReportStructure: 0,
      innerNarrativeCoherence: 0,
      affectiveModulation: 0,
      metaphorInvention: 0,
      consistencyPreference: 0,
    };
    this.signatureHistory = [];
    console.log('[ProtoPhenomenology] Metrics reset');
  }
}
