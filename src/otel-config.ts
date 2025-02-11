import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader, MetricReader } from '@opentelemetry/sdk-metrics';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { logs } from '@opentelemetry/api-logs';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Function to initialize OpenTelemetry
export async function initializeOpenTelemetry() {
    if (globalThis.__otel_sdk_instance) {
        console.log("OpenTelemetry SDK is already initialized.");
        return globalThis.__otel_sdk_instance;
    }

    console.log("Initializing OpenTelemetry SDK...");

    // Enable debug logging only once
    if (!globalThis.__otel_logger_set__) {
        diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
        globalThis.__otel_logger_set__ = true;
    }

    // Lumigo OTLP endpoint
    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://ga-otlp.lumigo-tracer-edge.golumigo.com';

    try {
        // Trace Exporter
        const traceExporter = new OTLPTraceExporter({
            url: `${otlpEndpoint}/v1/traces`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `LumigoToken ${process.env.LUMIGO_TRACER_TOKEN}`,
            },
        });

        // Metric Exporter
        const metricExporter = new OTLPMetricExporter({
            url: `${otlpEndpoint}/v1/metrics`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `LumigoToken ${process.env.LUMIGO_TRACER_TOKEN}`,
            },
            timeoutMillis: 20000,
            concurrencyLimit: 1,
        });

        const metricReader = new PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis: 60000, // Export every 60 seconds
        });

        // Logging Provider & Exporter
        const logExporter = new OTLPLogExporter({
            url: `${otlpEndpoint}/v1/logs`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `LumigoToken ${process.env.LUMIGO_TRACER_TOKEN}`,
            },
        });

        const loggerProvider = new LoggerProvider();
        loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(logExporter));

        // Set global logger provider only once
        if (!globalThis.__otel_logger_provider_set__) {
            logs.setGlobalLoggerProvider(loggerProvider);
            globalThis.__otel_logger_provider_set__ = true;
        }

        // Define OpenTelemetry SDK
        const sdk = new NodeSDK({
            resource: new Resource({
                [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'nestjs-app',
            }),
            traceExporter
        });

        await sdk.start();
        console.log("OpenTelemetry SDK started successfully");

        // Graceful shutdown
        const shutdown = async () => {
            try {
                console.log("Shutting down OpenTelemetry SDK...");
                await sdk.shutdown();
                await loggerProvider.shutdown();
                console.log("OpenTelemetry SDK shut down successfully");
                process.exit(0);
            } catch (error) {
                console.error("Failed to shut down OpenTelemetry SDK", error);
                process.exit(1);
            }
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

        // Store the instance globally
        globalThis.__otel_sdk_instance = sdk;
        return sdk;
    } catch (error) {
        console.error("Failed to initialize OpenTelemetry", error);
        throw error;
    }
}

// Function to get the OpenTelemetry SDK instance
export function getOpenTelemetrySDK() {
    if (!globalThis.__otel_sdk_instance) {
        throw new Error("OpenTelemetry SDK has not been initialized. Call initializeOpenTelemetry() first.");
    }
    return globalThis.__otel_sdk_instance;
}
