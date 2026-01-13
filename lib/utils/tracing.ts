// Basic OpenTelemetry tracing setup for React Native/Expo
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { registerGlobalTracerProvider } from '@opentelemetry/api';

let tracingInitialized = false;

export function setupTracing() {
  if (tracingInitialized) return;
  tracingInitialized = true;

  const provider = new WebTracerProvider();
  provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  provider.register();
  registerGlobalTracerProvider(provider);
  // You can add OTLP exporter here for remote collection if needed
  // For now, spans will be logged to the console
}
