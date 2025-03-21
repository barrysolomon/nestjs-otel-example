import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader, MeterProvider } from '@opentelemetry/sdk-metrics';
import { metrics } from '@opentelemetry/api';

let sdk: NodeSDK;
let loggerProvider: LoggerProvider;
let meterProvider: MeterProvider;

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

  // Configure the log exporter
  const logExporter = new OTLPLogExporter({
    url: 'http://otel-collector.observability.svc.cluster.local:4318/v1/logs',
    timeoutMillis: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Get the metrics endpoint from environment variable or use default
  const metricsUrl = (() => {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'otel-collector.observability.svc.cluster.local:4318';
    // Check if the endpoint starts with http, if not, add http://
    if (!endpoint.startsWith('http')) {
      return `http://${endpoint}`;
    }
    return endpoint;
  })();

  console.log(`Using metrics endpoint: ${metricsUrl}`);
  
  // Configure the metrics exporter
  const metricExporter = new OTLPMetricExporter({
    url: `${metricsUrl}/v1/metrics`,
    timeoutMillis: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Set up metrics
  meterProvider = new MeterProvider({
    resource: resource,
  });
  
  // Add a periodic metric reader
  meterProvider.addMetricReader(
    new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 15000, // Export metrics every 15 seconds
    })
  );
  
  // Set the global meter provider
  metrics.setGlobalMeterProvider(meterProvider);

  // Set up the logger provider
  loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(logExporter));

  // Set the global LoggerProvider
  logs.setGlobalLoggerProvider(loggerProvider);

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
      .then(() => {
        console.log('Tracing terminated');
        return meterProvider.shutdown();
      })
      .then(() => console.log('Metrics terminated'))
      .catch((error) => console.log('Error terminating telemetry', error))
      .finally(() => process.exit(0));
  });
}

export function getSDK(): NodeSDK {
  return sdk;
}

export function getLoggerProvider(): LoggerProvider {
  return loggerProvider;
}

export function getMeterProvider(): MeterProvider {
  return meterProvider;
}
