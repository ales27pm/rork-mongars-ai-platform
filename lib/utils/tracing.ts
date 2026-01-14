// Basic tracing setup for React Native/Expo
// OpenTelemetry integration can be added when needed

let tracingInitialized = false;

export function setupTracing() {
  if (tracingInitialized) return;
  tracingInitialized = true;
  
  console.log('[Tracing] Tracing initialized (console-only mode)');
}
