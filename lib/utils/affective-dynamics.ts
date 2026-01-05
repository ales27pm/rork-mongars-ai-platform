import type { AffectiveField, AffectiveDynamics, AffectiveTrajectory } from '@/types/affective';

export class AffectiveDynamicsSimulator {
  private dynamics: AffectiveDynamics;
  private dt: number = 0.1;

  constructor(dynamics?: Partial<AffectiveDynamics>) {
    this.dynamics = {
      lambdaV: 0.15,
      lambdaA: 0.2,
      lambdaU: 0.18,
      lambdaM: 0.12,
      wve: 0.3,
      wvm: 0.25,
      wvu: 0.2,
      wae: 0.35,
      wam: 0.3,
      alpha: 0.4,
      betaU: 0.25,
      gammaM: 0.15,
      etaU: 0.2,
      ...dynamics,
    };
  }

  public updateAffectiveField(
    current: AffectiveField,
    externalInput: number,
    metaFeedback: number,
    intrinsicStimulus: number
  ): AffectiveField {
    const gE = this.excitationFunction(externalInput);
    
    const dvdt = -this.dynamics.lambdaV * current.v + 
      this.dynamics.wve * gE + 
      this.dynamics.wvm * current.m - 
      this.dynamics.wvu * current.u;

    const dadt = -this.dynamics.lambdaA * current.a + 
      this.dynamics.wae * gE + 
      this.dynamics.wam * current.m;

    const predictionError = Math.abs(current.v - 0.5);
    const dudt = -this.dynamics.lambdaU * current.u + 
      this.dynamics.alpha * predictionError - 
      this.dynamics.betaU * metaFeedback;

    const dmdt = -this.dynamics.lambdaM * current.m + 
      intrinsicStimulus - 
      this.dynamics.gammaM * current.v + 
      this.dynamics.etaU * (1 - current.u);

    const next: AffectiveField = {
      v: this.clamp(current.v + this.dt * dvdt, -1, 1),
      a: this.clamp(current.a + this.dt * dadt, 0, 1),
      u: this.clamp(current.u + this.dt * dudt, 0, 1),
      m: this.clamp(current.m + this.dt * dmdt, 0, 1),
      timestamp: Date.now(),
    };

    return next;
  }

  private excitationFunction(input: number): number {
    return Math.tanh(input * 2) / 2 + 0.5;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  public computeEnergy(field: AffectiveField): number {
    return 0.5 * (
      this.dynamics.lambdaV * field.v * field.v +
      this.dynamics.lambdaA * field.a * field.a +
      this.dynamics.lambdaU * field.u * field.u +
      this.dynamics.lambdaM * field.m * field.m
    );
  }

  public computeEntropy(trajectory: AffectiveField[]): number {
    if (trajectory.length < 2) return 0;

    const variances = this.computeVariances(trajectory);
    const avgVariance = (variances.v + variances.a + variances.u + variances.m) / 4;
    
    const entropy = -Math.log(Math.max(0.0001, avgVariance));
    return this.clamp(entropy / 10, 0, 1);
  }

  private computeVariances(trajectory: AffectiveField[]): {
    v: number;
    a: number;
    u: number;
    m: number;
  } {
    const n = trajectory.length;
    const means = {
      v: trajectory.reduce((sum, f) => sum + f.v, 0) / n,
      a: trajectory.reduce((sum, f) => sum + f.a, 0) / n,
      u: trajectory.reduce((sum, f) => sum + f.u, 0) / n,
      m: trajectory.reduce((sum, f) => sum + f.m, 0) / n,
    };

    return {
      v: trajectory.reduce((sum, f) => sum + Math.pow(f.v - means.v, 2), 0) / n,
      a: trajectory.reduce((sum, f) => sum + Math.pow(f.a - means.a, 2), 0) / n,
      u: trajectory.reduce((sum, f) => sum + Math.pow(f.u - means.u, 2), 0) / n,
      m: trajectory.reduce((sum, f) => sum + Math.pow(f.m - means.m, 2), 0) / n,
    };
  }

  public analyzeTrajectory(history: AffectiveField[]): AffectiveTrajectory {
    if (history.length === 0) {
      return {
        history: [],
        energy: 0,
        entropy: 0,
        stability: 0,
      };
    }

    const energies = history.map(f => this.computeEnergy(f));
    const avgEnergy = energies.reduce((sum, e) => sum + e, 0) / energies.length;
    const entropy = this.computeEntropy(history);

    const variances = this.computeVariances(history);
    const totalVariance = variances.v + variances.a + variances.u + variances.m;
    const stability = 1 - Math.min(1, totalVariance);

    return {
      history,
      energy: avgEnergy,
      entropy,
      stability,
    };
  }

  public detectRegime(field: AffectiveField): {
    name: string;
    confidence: number;
  } {
    const { v, a, u, m } = field;

    if (a < 0.3 && u < 0.4 && v > 0) {
      return { name: 'calm-stability', confidence: 0.9 };
    }

    if (m > 0.7 && u > 0.3 && u < 0.7) {
      return { name: 'exploratory-curiosity', confidence: 0.85 };
    }

    if (u > 0.7 && Math.abs(v) < 0.3) {
      return { name: 'stress-adaptive', confidence: 0.8 };
    }

    if (v < -0.3 && u > 0.6) {
      return { name: 'negative-spiral', confidence: 0.75 };
    }

    return { name: 'transitional', confidence: 0.5 };
  }

  public simulateTrajectory(
    initial: AffectiveField,
    steps: number,
    inputSequence: number[],
    metaSequence: number[],
    stimulusSequence: number[]
  ): AffectiveField[] {
    const trajectory: AffectiveField[] = [initial];

    for (let i = 0; i < steps; i++) {
      const input = inputSequence[i % inputSequence.length] || 0;
      const meta = metaSequence[i % metaSequence.length] || 0;
      const stimulus = stimulusSequence[i % stimulusSequence.length] || 0;

      const next = this.updateAffectiveField(
        trajectory[trajectory.length - 1],
        input,
        meta,
        stimulus
      );

      trajectory.push(next);
    }

    return trajectory;
  }

  public getDynamics(): AffectiveDynamics {
    return { ...this.dynamics };
  }

  public setDynamics(dynamics: Partial<AffectiveDynamics>): void {
    this.dynamics = { ...this.dynamics, ...dynamics };
  }
}
