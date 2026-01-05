export interface SymbolicRule {
  id: string;
  pattern: RegExp;
  category: 'causal' | 'temporal' | 'spatial' | 'logical' | 'comparative';
  confidence: number;
  transform: (match: RegExpMatchArray) => string;
}

export interface LogicTrace {
  rule: string;
  matched: boolean;
  transformation?: string;
  confidence: number;
}

export class SymbolicReasoner {
  private rules: SymbolicRule[] = [
    {
      id: 'causal_because',
      pattern: /because\s+(.+?)\s+(?:therefore|thus|so|hence)\s+(.+)/i,
      category: 'causal',
      confidence: 0.9,
      transform: (m) => `CAUSAL_LINK(${m[1]} → ${m[2]})`,
    },
    {
      id: 'causal_if_then',
      pattern: /if\s+(.+?)\s+then\s+(.+)/i,
      category: 'causal',
      confidence: 0.85,
      transform: (m) => `CONDITIONAL(${m[1]} ⊃ ${m[2]})`,
    },
    {
      id: 'temporal_before_after',
      pattern: /(.+?)\s+(?:before|after)\s+(.+)/i,
      category: 'temporal',
      confidence: 0.8,
      transform: (m) => `TEMPORAL_ORDER(${m[1]} ≺ ${m[2]})`,
    },
    {
      id: 'comparative_more_than',
      pattern: /(.+?)\s+(?:more|less|greater|smaller)\s+than\s+(.+)/i,
      category: 'comparative',
      confidence: 0.85,
      transform: (m) => `COMPARE(${m[1]} ≷ ${m[2]})`,
    },
    {
      id: 'logical_and',
      pattern: /(.+?)\s+and\s+(.+)/i,
      category: 'logical',
      confidence: 0.75,
      transform: (m) => `CONJUNCTION(${m[1]} ∧ ${m[2]})`,
    },
    {
      id: 'logical_or',
      pattern: /(?:either\s+)?(.+?)\s+or\s+(.+)/i,
      category: 'logical',
      confidence: 0.75,
      transform: (m) => `DISJUNCTION(${m[1]} ∨ ${m[2]})`,
    },
    {
      id: 'negation',
      pattern: /(?:not|never|no)\s+(.+)/i,
      category: 'logical',
      confidence: 0.8,
      transform: (m) => `NEGATION(¬${m[1]})`,
    },
    {
      id: 'universal_all',
      pattern: /(?:all|every|each)\s+(.+?)\s+(?:are|is)\s+(.+)/i,
      category: 'logical',
      confidence: 0.85,
      transform: (m) => `UNIVERSAL(∀x: ${m[1]}(x) → ${m[2]}(x))`,
    },
    {
      id: 'existential_some',
      pattern: /(?:some|any)\s+(.+?)\s+(?:are|is)\s+(.+)/i,
      category: 'logical',
      confidence: 0.8,
      transform: (m) => `EXISTENTIAL(∃x: ${m[1]}(x) ∧ ${m[2]}(x))`,
    },
  ];

  analyze(text: string): LogicTrace[] {
    const traces: LogicTrace[] = [];

    for (const rule of this.rules) {
      const match = text.match(rule.pattern);
      if (match) {
        traces.push({
          rule: rule.id,
          matched: true,
          transformation: rule.transform(match),
          confidence: rule.confidence,
        });
      }
    }

    return traces;
  }

  extractPredicates(text: string): string[] {
    const traces = this.analyze(text);
    return traces
      .filter(t => t.transformation)
      .map(t => t.transformation!);
  }

  inferConsequences(predicates: string[]): string[] {
    const consequences: string[] = [];

    for (const predicate of predicates) {
      if (predicate.includes('CAUSAL_LINK')) {
        const match = predicate.match(/CAUSAL_LINK\((.+?)\s+→\s+(.+?)\)/);
        if (match) {
          consequences.push(`Given ${match[1]}, we can infer ${match[2]}`);
        }
      }

      if (predicate.includes('CONDITIONAL')) {
        const match = predicate.match(/CONDITIONAL\((.+?)\s+⊃\s+(.+?)\)/);
        if (match) {
          consequences.push(`If ${match[1]} holds, then ${match[2]} must follow`);
        }
      }

      if (predicate.includes('UNIVERSAL')) {
        consequences.push(`This applies to all instances in the domain`);
      }
    }

    return consequences;
  }

  buildKnowledgeGraph(traces: LogicTrace[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const trace of traces) {
      if (!trace.transformation) continue;

      const category = this.rules.find(r => r.id === trace.rule)?.category || 'unknown';
      
      if (!graph.has(category)) {
        graph.set(category, []);
      }

      graph.get(category)!.push(trace.transformation);
    }

    return graph;
  }
}
