# monGARS Introspection System

## Overview
The introspection system provides real-time self-inspection of internal cognitive states, data flows, and reasoning traces without exposing private data or model weights.

## Architecture

### 1. Instrumentation Layer
**Location:** `lib/providers/instrumentation.tsx`

Structured logging and visualization hooks for each major subsystem:
- Records metrics with timestamps, duration, and confidence
- Tracks subsystem states (idle, active, overloaded, error)
- Applies privacy filters (masks user content, model weights, secrets)
- Buffers metrics with automatic flushing

**Key Features:**
- Per-subsystem state tracking
- Privacy-preserving metadata
- Configurable granularity (minimal, standard, detailed, debug)
- Automatic TTL-based pruning

### 2. Introspection API
**Location:** `lib/providers/introspection-api.tsx`

Secure read-only API for querying runtime context:

**Methods:**
- `captureSnapshot()`: Full system snapshot with subsystem states
- `queryCognitiveState()`: Current cognitive state (goals, modules, confidence)
- `reflect(query)`: Natural language introspection query
- `auditSelf()`: Comprehensive self-audit

**Privacy Guarantees:**
- Read-only access (no state mutation)
- No raw parameter exposure
- Semantically labeled summaries only

### 3. Self-Model Representation
**Location:** `lib/providers/self-model.tsx`

Lightweight schema maintaining an abstract map of subsystems:
- Architecture version and capabilities
- Subsystem dependencies and states
- Configuration (privacy mode, sampling rate)

**Core Subsystems:**
- Cognition Core
- Hippocampus Memory
- Unified LLM Runtime
- Evolution Engine
- Personality Engine
- Telemetry System
- Persistence Layer
- Sommeil Paradoxal

### 4. Cognition Integration
**Location:** `lib/providers/cognition.tsx`

The Cognition Core can introspect during runtime:

```typescript
// Reflect on a specific query
const result = await cognition.reflect('How is my performance?');

// Perform full self-audit
const audit = await cognition.auditSelf();

// Inspect current cognitive state
const state = cognition.inspectCognitiveState();
```

## Usage

### Chat Commands
The chat interface supports introspection commands:

- `audit` or `self-audit` → Full system audit
- `inspect` or `inspect state` → Current cognitive state
- `reflect <query>` → Reflection on specific aspect
- Keywords: `look inside`, `introspect` → Trigger reflection

### UI Screens

**Introspection Tab** (`app/(tabs)/introspection.tsx`)
- Real-time system health dashboard
- Cognitive state visualization
- Subsystem performance metrics
- Reflection command buttons

**Diagnostics Tab** (`app/(tabs)/diagnostics.tsx`)
- Model slot manager statistics
- Sommeil Paradoxal metrics
- Inference performance (P50, P95, P99)
- Recent errors and symbolic reasoning traces

## Implementation Details

### Instrumentation Hooks
All major operations are instrumented:

```typescript
const endOp = instrumentation.startOperation('subsystem', 'operation', metadata);
try {
  // ... operation logic
} finally {
  endOp(); // Records duration automatically
}
```

### Privacy Filters
Applied recursively to all metadata:
- `userInput`, `response`, `content` → `[REDACTED]`
- `weights`, `parameters` → `[MASKED]`
- Keys with `secret`, `key`, `token` → `[SECRET]`

### Subsystem State Calculation
- **Status**: `idle`, `active`, `overloaded`, `error`
- **Metrics**: Operation count, average duration, error rate, cache hit rate
- **Resources**: Memory usage, active threads, queue depth

### Reflection Engine
Generates insights by analyzing:
1. Performance (latency, throughput)
2. Health (error rates, subsystem status)
3. Behavior (activity patterns, module engagement)
4. Resources (memory, VRAM utilization)

**Confidence Scoring:**
Each insight includes a confidence score (0.0-1.0) based on:
- Metric stability
- Sample size
- Time window

### Snapshot Structure
```typescript
interface IntrospectionSnapshot {
  timestamp: number;
  sessionId: string;
  subsystems: SubsystemState[];
  cognitiveState: CognitiveState;
  systemHealth: {
    overallStatus: 'healthy' | 'degraded' | 'critical';
    alerts: string[];
    uptime: number;
  };
  recentEvents: InstrumentationMetric[];
}
```

## Security & Privacy

### Read-Only Guarantees
- No methods mutate internal state
- All queries return immutable snapshots
- Introspection endpoints cannot alter weights or functions

### Privacy-First Design
1. **User Content Masking**: All user input/output redacted
2. **Model Weight Protection**: Parameter values never exposed
3. **Secret Filtering**: API keys and tokens automatically hidden
4. **Metadata Only**: Only high-level summaries, no raw data

### Configurable Privacy Levels
```typescript
privacyFilters: {
  maskUserContent: true,    // Redact user interactions
  maskModelWeights: true,   // Hide parameter values
  maskSecrets: true,        // Filter credentials
}
```

## Performance Impact

### Overhead Mitigation
- **Buffer-based flushing**: Metrics batched (default 1000 items)
- **Sampling**: Configurable rate (default 1.0 = 100%)
- **Lazy evaluation**: Snapshots generated on-demand
- **TTL pruning**: Old metrics auto-expired

### Memory Footprint
- Instrumentation: ~50-100 KB per 1000 metrics
- Subsystem states: ~5 KB total
- Snapshots: Generated on-demand (not persisted)

## Testing

### Verification Points
1. ✅ Instrumentation records metrics correctly
2. ✅ Privacy filters mask sensitive data
3. ✅ Introspection API is read-only
4. ✅ Reflection generates valid insights
5. ✅ Chat commands trigger introspection
6. ✅ Subsystem states update in real-time

### Manual Testing
```bash
# In chat:
> audit
> inspect state
> reflect on my memory usage
> look inside yourself
```

## Future Enhancements

### Planned Features
1. **Time-series visualization**: Historical metric trends
2. **Anomaly detection**: Automatic degradation alerts
3. **Comparative analysis**: Benchmark against baselines
4. **Export capabilities**: JSON snapshots for external analysis
5. **Custom instrumentation**: User-defined metrics

### Research Directions
1. **Causal tracing**: Map input → reasoning → output chains
2. **Attention visualization**: Track module focus shifts
3. **Self-explanation**: Natural language trace generation
4. **Confidence calibration**: Improve prediction accuracy

## References

- **Introspection Types**: `types/introspection.ts`
- **Provider Implementations**: `lib/providers/introspection-api.tsx`, `lib/providers/instrumentation.tsx`, `lib/providers/self-model.tsx`
- **UI Components**: `app/(tabs)/introspection.tsx`
- **Integration Examples**: `lib/providers/cognition.tsx`
