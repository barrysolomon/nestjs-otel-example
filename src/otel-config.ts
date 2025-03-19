import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

let sdk: NodeSDK;

export async function initializeOpenTelemetry() {
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'nestjs-opentelemetry-example',
  });

  const traceExporter = new OTLPTraceExporter({
    url: 'http://otel-collector.observability.svc.cluster.local:4318/v1/traces',
    timeoutMillis: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingPaths: ['/health'],
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-nestjs-core': {
          enabled: true,
        },
      }),
    ],
  });

  try {
    await sdk.start();
    console.log('OpenTelemetry SDK started successfully');
  } catch (error) {
    console.error('Error initializing OpenTelemetry SDK:', error);
  }

  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.log('Error terminating tracing', error))
      .finally(() => process.exit(0));
  });
}

export function getSDK(): NodeSDK {
  return sdk;
}
