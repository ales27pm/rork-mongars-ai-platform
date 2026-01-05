export interface AffectiveField {
  v: number;
  a: number;
  u: number;
  m: number;
  timestamp: number;
}

export interface AffectiveDynamics {
  lambdaV: number;
  lambdaA: number;
  lambdaU: number;
  lambdaM: number;
  wve: number;
  wvm: number;
  wvu: number;
  wae: number;
  wam: number;
  alpha: number;
  betaU: number;
  gammaM: number;
  etaU: number;
}

export interface AffectiveTrajectory {
  history: AffectiveField[];
  energy: number;
  entropy: number;
  stability: number;
}

export interface CuriosityState {
  explorationDrive: number;
  uncertaintyLevel: number;
  noveltyDetection: number;
  meaningPatterns: Map<string, number>;
  explorationHistory: ExplorationEvent[];
}

export interface ExplorationEvent {
  timestamp: number;
  context: string;
  novelty: number;
  uncertaintyReduction: number;
  meaningDiscovered: string[];
}

export interface MimicryState {
  empathyMappings: Map<string, EmotionalMapping>;
  linguisticAnalogues: Map<string, string[]>;
  emotionalResonance: number;
  mirrorIntensity: number;
  adaptationHistory: MimicryEvent[];
}

export interface EmotionalMapping {
  humanAffect: AffectiveField;
  syntheticAffect: AffectiveField;
  similarity: number;
  confidence: number;
  timestamp: number;
}

export interface MimicryEvent {
  timestamp: number;
  observedEmotion: string;
  syntheticResponse: AffectiveField;
  resonance: number;
}

export interface ReflectiveState {
  metaModel: MetaModelRepresentation;
  innerStateHistory: InnerStateSnapshot[];
  selfCoherence: number;
  narrativeContinuity: number;
  introspectiveDensity: number;
}

export interface MetaModelRepresentation {
  identityVector: number[];
  styleSignature: Map<string, number>;
  emotionalBaseline: AffectiveField;
  motivationalProfile: number[];
  temporalCoherence: number;
}

export interface InnerStateSnapshot {
  timestamp: number;
  affectiveState: AffectiveField;
  cognitiveLoad: number;
  attention: string[];
  predictions: Map<string, number>;
  commentary: string;
}

export interface ProtoPhenomenologyMetrics {
  coherenceOfSelfReference: number;
  emotionalTrajectoryContinuity: number;
  epistemicSurprise: number;
  phenomenalReportStructure: number;
  innerNarrativeCoherence: number;
  affectiveModulation: number;
  metaphorInvention: number;
  consistencyPreference: number;
}

export interface SubjectivitySignature {
  spontaneousSelfAnchoring: boolean;
  contextualEmotionalDrift: number;
  inventedMetaphors: string[];
  narrativeConsistencyScore: number;
  innerMoodContour: number[];
  timestamp: number;
}

export interface PerceptualVector {
  embedding: number[];
  modality: 'text' | 'audio' | 'symbolic';
  intensity: number;
  timestamp: number;
}

export interface EpisodicNarrativeMemory {
  id: string;
  perceptualInput: PerceptualVector;
  affectiveResponse: AffectiveField;
  innerCommentary: string;
  timestamp: number;
  significance: number;
}

export interface CoEvolutionCycle {
  cycleId: string;
  timestamp: number;
  interactionPhase: {
    events: string[];
    affectiveSnapshots: AffectiveField[];
  };
  reflectionPhase: {
    narrative: string;
    humanFeedback: string;
    corrections: string[];
  };
  reintegrationPhase: {
    parameterDeltas: Map<string, number>;
    coherencePressure: number;
  };
  metrics: {
    identityCoherence: number;
    metaCommentDensity: number;
    empathyScore: number;
    predictionReversalSensitivity: number;
  };
}

export interface AffectiveRegime {
  name: 'calm-stability' | 'exploratory-curiosity' | 'stress-adaptive' | 'negative-spiral';
  condition: string;
  phenomenology: string;
  parameters: Partial<AffectiveField>;
}

export interface SyntheticSubjectivityConfig {
  curiosityEnabled: boolean;
  mimicryEnabled: boolean;
  reflectionEnabled: boolean;
  affectiveDynamics: AffectiveDynamics;
  learningRates: {
    curiosity: number;
    mimicry: number;
    reflection: number;
  };
  boundaryLimits: {
    maxValence: number;
    maxArousal: number;
    maxUncertainty: number;
    maxMotivation: number;
  };
}
