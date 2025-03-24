import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { Logger } from '@nestjs/common';

let sdk: NodeSDK | null = null;

export async function initializeOpenTelemetry(
  serviceName: string,
  tracesEndpoint: string,
  logsEndpoint: string,
  metricsEndpoint: string,
): Promise<NodeSDK> {
  const logger = new Logger('OpenTelemetry');

  // Check if OpenTelemetry is enabled
  if (process.env.ENABLE_OTEL !== 'true') {
    logger.log('OpenTelemetry is disabled. Set ENABLE_OTEL=true to enable telemetry.');
    return null;
  }

  try {
    // Create resource with service name
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    });

    // Create exporters with headers if defined
    const headers = process.env.OTEL_EXPORTER_OTLP_HEADERS ? 
      JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS) : 
      undefined;

    const traceExporter = new OTLPTraceExporter({
      url: tracesEndpoint,
      headers,
    });

    const metricExporter = new OTLPMetricExporter({
      url: metricsEndpoint,
      headers,
    });

    const logExporter = new OTLPLogExporter({
      url: logsEndpoint,
      headers,
    });

    // Create SDK configuration
    const sdkConfig = {
      resource,
      spanProcessor: new SimpleSpanProcessor(traceExporter),
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 1000,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-nestjs-core': {
            enabled: true,
          },
        }),
      ],
    };

    // Create SDK
    sdk = new NodeSDK(sdkConfig);

    // Start the SDK
    await startSdk(sdk);
    return sdk;
  } catch (error) {
    logger.error('Failed to initialize OpenTelemetry:', error);
    throw error;
  }
}

export async function startSdk(sdk: NodeSDK): Promise<void> {
  const logger = new Logger('OpenTelemetry');
  
  try {
    await sdk.start();
    logger.log('OpenTelemetry SDK started successfully');
  } catch (error) {
    logger.error('Failed to start OpenTelemetry SDK:', error);
    throw error;
  }
}

export async function shutdownSdk(): Promise<void> {
  const logger = new Logger('OpenTelemetry');
  
  if (sdk) {
    try {
      await sdk.shutdown();
      logger.log('OpenTelemetry SDK shut down successfully');
    } catch (error) {
      logger.error('Failed to shut down OpenTelemetry SDK:', error);
      throw error;
    }
  }
}

export function getSDK(): NodeSDK | null {
  return sdk;
}

export async function reinitializeOpenTelemetry(
  serviceName: string,
  tracesEndpoint: string,
  logsEndpoint: string,
  metricsEndpoint: string,
): Promise<NodeSDK> {
  const logger = new Logger('OpenTelemetry');

  // Check if OpenTelemetry is enabled
  if (process.env.ENABLE_OTEL !== 'true') {
    logger.log('OpenTelemetry is disabled. Set ENABLE_OTEL=true to enable telemetry.');
    return null;
  }

  try {
    // Shutdown existing SDK if it exists
    if (sdk) {
      await shutdownSdk();
    }

    // Initialize new SDK
    return await initializeOpenTelemetry(
      serviceName,
      tracesEndpoint,
      logsEndpoint,
      metricsEndpoint,
    );
  } catch (error) {
    logger.error('Failed to reinitialize OpenTelemetry:', error);
    throw error;
  }
} 