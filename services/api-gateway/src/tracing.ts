import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
const { Resource } = require('@opentelemetry/resources');
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const exporterOptions = {
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
};

const traceExporter = new OTLPTraceExporter(exporterOptions);

export const otelSDK = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'markova-api-gateway',
  }),
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

// Start SDK gracefully (don't block main process initialization blindly)
try {
  otelSDK.start();
  console.log('📡 OpenTelemetry initialized for markova-api-gateway');
} catch (error) {
  console.error('⚠️ Error initializing OpenTelemetry', error);
}

process.on('SIGTERM', () => {
  otelSDK.shutdown()
    .then(() => console.log('OpenTelemetry shut down successfully'))
    .catch((error) => console.error('Error shutting down OpenTelemetry', error))
    .finally(() => process.exit(0));
});
