import type { MemoryEntry, Message } from '@/types';
import type { AffectiveField } from '@/types/affective';
import { generateRealEmbedding, cosineSimilarity } from './embedding';

export interface AffectIdentityNarrative {
  id: string;
  userId: string;
  narrativeType: 'identity' | 'relationship' | 'goal' | 'value' | 'emotion';
  content: string;
  affectiveSignature: AffectiveField;
  confidence: number;
  supportingMemories: string[];
  timestamp: number;
  lastUpdated: number;
  strength: number;
  embedding?: number[];
}

export interface MemorySynthesisResult {
  narratives: AffectIdentityNarrative[];
  clusters: MemoryCluster[];
  identityCoherence: number;
  affectiveConsistency: number;
  temporalContinuity: number;
}

export interface MemoryCluster {
  id: string;
  centroid: number[];
  members: string[];
  affectiveTone: AffectiveField;
  theme: string;
  coherence: number;
}

export class MemorySynthesisEngine {
  private narratives: Map<string, AffectIdentityNarrative> = new Map();
  private clusterCache: MemoryCluster[] = [];
  private lastSynthesis: number = 0;
  private readonly SYNTHESIS_INTERVAL = 60000;

  async synthesizeFromMemories(
    memories: MemoryEntry[],
    messages: Message[],
    currentAffect: AffectiveField
  ): Promise<MemorySynthesisResult> {
    console.log('[MemorySynthesis] Starting synthesis from', memories.length, 'memories');

    const clusters = await this.clusterMemories(memories);
    
    const extractedNarratives = await this.extractNarratives(clusters, messages, currentAffect);
    
    this.updateNarratives(extractedNarratives);
    
    const identityCoherence = this.computeIdentityCoherence();
    const affectiveConsistency = this.computeAffectiveConsistency();
    const temporalContinuity = this.computeTemporalContinuity();

    this.lastSynthesis = Date.now();

    return {
      narratives: Array.from(this.narratives.values()),
      clusters,
      identityCoherence,
      affectiveConsistency,
      temporalContinuity,
    };
  }

  private async clusterMemories(memories: MemoryEntry[]): Promise<MemoryCluster[]> {
    if (memories.length === 0) return [];

    const embeddings = memories.map(m => m.embedding);
    const k = Math.min(5, Math.max(2, Math.floor(memories.length / 10)));
    
    const clusters = this.kMeansClustering(embeddings, memories, k);
    
    this.clusterCache = clusters;
    return clusters;
  }

  private kMeansClustering(
    embeddings: number[][],
    memories: MemoryEntry[],
    k: number
  ): MemoryCluster[] {
    const dim = embeddings[0].length;
    let centroids: number[][] = [];
    
    for (let i = 0; i < k; i++) {
      const idx = Math.floor((i / k) * embeddings.length);
      centroids.push([...embeddings[idx]]);
    }

    let assignments = new Array(embeddings.length).fill(0);
    let converged = false;
    let iterations = 0;
    const maxIterations = 20;

    while (!converged && iterations < maxIterations) {
      const newAssignments = embeddings.map((emb, idx) => {
        let minDist = Infinity;
        let bestCluster = 0;
        
        centroids.forEach((centroid, cIdx) => {
          const dist = this.euclideanDistance(emb, centroid);
          if (dist < minDist) {
            minDist = dist;
            bestCluster = cIdx;
          }
        });
        
        return bestCluster;
      });

      converged = assignments.every((a, i) => a === newAssignments[i]);
      assignments = newAssignments;

      centroids = centroids.map((_, cIdx) => {
        const clusterMembers = embeddings.filter((_, idx) => assignments[idx] === cIdx);
        if (clusterMembers.length === 0) return centroids[cIdx];
        
        const sum = new Array(dim).fill(0);
        clusterMembers.forEach(member => {
          member.forEach((val, i) => sum[i] += val);
        });
        return sum.map(s => s / clusterMembers.length);
      });

      iterations++;
    }

    const clusters: MemoryCluster[] = centroids.map((centroid, cIdx) => {
      const memberIndices = assignments
        .map((a, i) => (a === cIdx ? i : -1))
        .filter(i => i !== -1);
      
      const clusterMemories = memberIndices.map(i => memories[i]);
      
      const avgAffect = this.averageAffect(
        clusterMemories
          .map(m => (m as any).affectiveState)
          .filter(Boolean)
      );
      
      const theme = this.inferTheme(clusterMemories);
      
      const coherence = this.computeClusterCoherence(
        memberIndices.map(i => embeddings[i]),
        centroid
      );

      return {
        id: `cluster_${cIdx}_${Date.now()}`,
        centroid,
        members: clusterMemories.map(m => m.id),
        affectiveTone: avgAffect,
        theme,
        coherence,
      };
    });

    return clusters.filter(c => c.members.length > 0);
  }

  private async extractNarratives(
    clusters: MemoryCluster[],
    messages: Message[],
    currentAffect: AffectiveField
  ): Promise<AffectIdentityNarrative[]> {
    const narratives: AffectIdentityNarrative[] = [];

    for (const cluster of clusters) {
      const narrative = await this.clusterToNarrative(cluster, messages, currentAffect);
      if (narrative) {
        narratives.push(narrative);
      }
    }

    const relationshipNarratives = this.extractRelationshipNarratives(messages);
    narratives.push(...relationshipNarratives);

    const emotionalNarratives = this.extractEmotionalPatterns(messages);
    narratives.push(...emotionalNarratives);

    return narratives;
  }

  private async clusterToNarrative(
    cluster: MemoryCluster,
    messages: Message[],
    currentAffect: AffectiveField
  ): Promise<AffectIdentityNarrative | null> {
    if (cluster.members.length < 2) return null;

    const content = `${cluster.theme} (based on ${cluster.members.length} memories)`;
    
    const embedding = await generateRealEmbedding(content);

    return {
      id: `narrative_${Date.now()}_${Math.random()}`,
      userId: 'default',
      narrativeType: this.inferNarrativeType(cluster.theme),
      content,
      affectiveSignature: cluster.affectiveTone,
      confidence: cluster.coherence,
      supportingMemories: cluster.members,
      timestamp: Date.now(),
      lastUpdated: Date.now(),
      strength: Math.min(1, cluster.members.length / 10),
      embedding,
    };
  }

  private extractRelationshipNarratives(messages: Message[]): AffectIdentityNarrative[] {
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length < 5) return [];

    const avgAffect = this.averageAffect(
      userMessages.map(m => (m as any).affectiveState).filter(Boolean)
    );

    return [{
      id: `relationship_${Date.now()}`,
      userId: 'default',
      narrativeType: 'relationship',
      content: `Ongoing conversation with ${userMessages.length} interactions`,
      affectiveSignature: avgAffect,
      confidence: Math.min(1, userMessages.length / 20),
      supportingMemories: userMessages.map(m => m.id),
      timestamp: Date.now(),
      lastUpdated: Date.now(),
      strength: Math.min(1, userMessages.length / 50),
    }];
  }

  private extractEmotionalPatterns(messages: Message[]): AffectIdentityNarrative[] {
    const recentMessages = messages.slice(-10);
    const affectiveStates = recentMessages
      .map(m => (m as any).metadata?.affectiveState)
      .filter(Boolean);

    if (affectiveStates.length === 0) return [];

    const avgAffect = this.averageAffect(affectiveStates);
    const variance = this.computeAffectiveVariance(affectiveStates);

    const emotionalState = variance > 0.3 ? 'dynamic' : 'stable';

    return [{
      id: `emotion_${Date.now()}`,
      userId: 'default',
      narrativeType: 'emotion',
      content: `Emotional state: ${emotionalState} (variance: ${variance.toFixed(2)})`,
      affectiveSignature: avgAffect,
      confidence: 0.7,
      supportingMemories: recentMessages.map(m => m.id),
      timestamp: Date.now(),
      lastUpdated: Date.now(),
      strength: 0.5,
    }];
  }

  private updateNarratives(newNarratives: AffectIdentityNarrative[]): void {
    for (const narrative of newNarratives) {
      const existing = Array.from(this.narratives.values()).find(
        n => n.narrativeType === narrative.narrativeType && 
             cosineSimilarity(n.embedding || [], narrative.embedding || []) > 0.85
      );

      if (existing) {
        this.narratives.set(existing.id, {
          ...existing,
          content: narrative.content,
          affectiveSignature: this.blendAffect(existing.affectiveSignature, narrative.affectiveSignature, 0.3),
          confidence: (existing.confidence + narrative.confidence) / 2,
          supportingMemories: [...new Set([...existing.supportingMemories, ...narrative.supportingMemories])],
          lastUpdated: Date.now(),
          strength: Math.min(1, existing.strength + 0.1),
        });
      } else {
        this.narratives.set(narrative.id, narrative);
      }
    }

    this.pruneWeakNarratives();
  }

  private pruneWeakNarratives(): void {
    const now = Date.now();
    const ageThreshold = 7 * 24 * 60 * 60 * 1000;

    for (const [id, narrative] of this.narratives.entries()) {
      const age = now - narrative.lastUpdated;
      if (narrative.strength < 0.2 && age > ageThreshold) {
        this.narratives.delete(id);
      }
    }
  }

  private computeIdentityCoherence(): number {
    const identityNarratives = Array.from(this.narratives.values())
      .filter(n => n.narrativeType === 'identity');

    if (identityNarratives.length < 2) return 1.0;

    const embeddings = identityNarratives.map(n => n.embedding || []);
    let totalSimilarity = 0;
    let count = 0;

    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        totalSimilarity += cosineSimilarity(embeddings[i], embeddings[j]);
        count++;
      }
    }

    return count > 0 ? totalSimilarity / count : 1.0;
  }

  private computeAffectiveConsistency(): number {
    const narratives = Array.from(this.narratives.values());
    if (narratives.length < 2) return 1.0;

    const affects = narratives.map(n => n.affectiveSignature);
    let totalDistance = 0;

    for (let i = 0; i < affects.length - 1; i++) {
      totalDistance += this.affectiveDistance(affects[i], affects[i + 1]);
    }

    const avgDistance = totalDistance / (affects.length - 1);
    return Math.max(0, 1 - avgDistance);
  }

  private computeTemporalContinuity(): number {
    const narratives = Array.from(this.narratives.values())
      .sort((a, b) => a.timestamp - b.timestamp);

    if (narratives.length < 2) return 1.0;

    let continuityScore = 0;
    for (let i = 0; i < narratives.length - 1; i++) {
      const timeDelta = narratives[i + 1].timestamp - narratives[i].timestamp;
      const expectedGap = 24 * 60 * 60 * 1000;
      const gapScore = Math.exp(-Math.abs(timeDelta - expectedGap) / expectedGap);
      
      const contentSim = cosineSimilarity(
        narratives[i].embedding || [],
        narratives[i + 1].embedding || []
      );
      
      continuityScore += (gapScore + contentSim) / 2;
    }

    return continuityScore / (narratives.length - 1);
  }

  private euclideanDistance(a: number[], b: number[]): number {
    return Math.sqrt(
      a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
    );
  }

  private averageAffect(affects: AffectiveField[]): AffectiveField {
    if (affects.length === 0) {
      return { v: 0, a: 0, u: 0.5, m: 0, timestamp: Date.now() };
    }

    const sum = affects.reduce(
      (acc, a) => ({
        v: acc.v + a.v,
        a: acc.a + a.a,
        u: acc.u + a.u,
        m: acc.m + a.m,
        timestamp: Date.now(),
      }),
      { v: 0, a: 0, u: 0, m: 0, timestamp: Date.now() }
    );

    return {
      v: sum.v / affects.length,
      a: sum.a / affects.length,
      u: sum.u / affects.length,
      m: sum.m / affects.length,
      timestamp: Date.now(),
    };
  }

  private computeAffectiveVariance(affects: AffectiveField[]): number {
    const avg = this.averageAffect(affects);
    const variance = affects.reduce((sum, a) => {
      return sum + Math.pow(a.v - avg.v, 2) + Math.pow(a.a - avg.a, 2);
    }, 0) / affects.length;
    
    return Math.sqrt(variance);
  }

  private affectiveDistance(a: AffectiveField, b: AffectiveField): number {
    return Math.sqrt(
      Math.pow(a.v - b.v, 2) +
      Math.pow(a.a - b.a, 2) +
      Math.pow(a.u - b.u, 2) +
      Math.pow(a.m - b.m, 2)
    );
  }

  private blendAffect(a: AffectiveField, b: AffectiveField, ratio: number): AffectiveField {
    return {
      v: a.v * (1 - ratio) + b.v * ratio,
      a: a.a * (1 - ratio) + b.a * ratio,
      u: a.u * (1 - ratio) + b.u * ratio,
      m: a.m * (1 - ratio) + b.m * ratio,
      timestamp: Date.now(),
    };
  }

  private inferTheme(memories: MemoryEntry[]): string {
    const contents = memories.map(m => m.content.toLowerCase());
    const words = contents.join(' ').split(/\s+/);
    
    const wordFreq: { [key: string]: number } = {};
    words.forEach(word => {
      if (word.length > 4) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    const topWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);

    return topWords.join(', ') || 'general knowledge';
  }

  private inferNarrativeType(theme: string): AffectIdentityNarrative['narrativeType'] {
    const lowerTheme = theme.toLowerCase();
    
    if (lowerTheme.includes('goal') || lowerTheme.includes('plan')) return 'goal';
    if (lowerTheme.includes('feel') || lowerTheme.includes('emotion')) return 'emotion';
    if (lowerTheme.includes('value') || lowerTheme.includes('believe')) return 'value';
    if (lowerTheme.includes('relationship') || lowerTheme.includes('friend')) return 'relationship';
    
    return 'identity';
  }

  private computeClusterCoherence(embeddings: number[][], centroid: number[]): number {
    if (embeddings.length === 0) return 0;
    
    const similarities = embeddings.map(emb => cosineSimilarity(emb, centroid));
    return similarities.reduce((a, b) => a + b, 0) / similarities.length;
  }

  getNarratives(): AffectIdentityNarrative[] {
    return Array.from(this.narratives.values());
  }

  getClusters(): MemoryCluster[] {
    return this.clusterCache;
  }

  clearNarratives(): void {
    this.narratives.clear();
    this.clusterCache = [];
  }
}
