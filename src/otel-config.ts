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

export const initializeOpenTelemetry = async (
  serviceName: string,
  tracesUrl: string,
  logsUrl: string,
  metricsUrl: string,
): Promise<NodeSDK> => {
  console.log('OpenTelemetry Environment Variables:');
  console.log(`OTEL_SERVICE_NAME: ${process.env.OTEL_SERVICE_NAME || 'Not set'}`);
  console.log(`OTEL_EXPORTER_OTLP_PROTOCOL: ${process.env.OTEL_EXPORTER_OTLP_PROTOCOL || 'Not set'}`);
  console.log(`OTEL_EXPORTER_OTLP_ENDPOINT: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'Not set'}`);
  console.log(`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: ${process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'Not set'}`);
  console.log(`OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: ${process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || 'Not set'}`);
  console.log(`OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: ${process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'Not set'}`);

  // Create a resource that labels all telemetry with service name
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  });

  // Initialize the metric provider
  const metricExporter = new OTLPMetricExporter({
    url: metricsUrl || process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
  });
  console.log('Using metrics endpoint:', metricsUrl || process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || '(using environment defaults)');
  
  const meterProvider = new MeterProvider({
    resource: resource,
  });
  
  meterProvider.addMetricReader(new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 1000,
  }));
  
  // Set the global meter provider
  metrics.setGlobalMeterProvider(meterProvider);

  // Initialize the log provider
  const logExporter = new OTLPLogExporter({
    url: logsUrl || process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
  });
  console.log('Using logs endpoint:', logsUrl || process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || '(using environment defaults)');
  
  const loggerProvider = new LoggerProvider({
    resource: resource,
  });
  
  loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(logExporter));
  
  // Set the global logger provider
  logs.setGlobalLoggerProvider(loggerProvider);

  // Create and register SDK
  const traceExporter = new OTLPTraceExporter({
    url: tracesUrl || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  });
  console.log('Using traces endpoint:', tracesUrl || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || '(using environment defaults)');
  
  const newSdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  // Assign to the global SDK variable
  sdk = newSdk;
  
  // Start the SDK and return it
  try {
    await sdk.start();
    console.log('OpenTelemetry SDK started successfully');
  } catch (error) {
    console.error('Error starting OpenTelemetry SDK:', error);
    throw error;
  }

  return sdk;
};

export function getSDK(): NodeSDK {
  return sdk;
}

export function getLoggerProvider(): LoggerProvider {
  return loggerProvider;
}

export function getMeterProvider(): MeterProvider {
  return meterProvider;
}

export async function startSdk(): Promise<void> {
  if (sdk) {
    try {
      // Check if SDK is already started
      if (sdk['_isShutdown'] === false) {
        console.log('OpenTelemetry SDK is already running');
        return;
      }
      
      await sdk.start();
      console.log('OpenTelemetry SDK started successfully');
      
      // Set up graceful shutdown
      process.on('SIGTERM', async () => {
        try {
          await sdk.shutdown();
          console.log('OpenTelemetry SDK shut down successfully');
        } catch (error) {
          console.error('Error shutting down OpenTelemetry SDK:', error);
        } finally {
          process.exit(0);
        }
      });
    } catch (error) {
      console.error('Error starting OpenTelemetry SDK:', error);
    }
  } else {
    console.error('OpenTelemetry SDK not initialized');
  }
}

export async function reinitializeOpenTelemetry(): Promise<void> {
  // Get the selected collector from the config
  const serviceName = process.env.OTEL_SERVICE_NAME || '';
  const tracesUrl = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || '';
  const logsUrl = process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || '';
  const metricsUrl = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || '';

  // Initialize with current environment variables
  sdk = await initializeOpenTelemetry(
    serviceName,
    tracesUrl,
    logsUrl,
    metricsUrl
  );
}
