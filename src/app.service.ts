import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { trace, context } from '@opentelemetry/api';
import { winstonLogger, pinoLogger } from './logger.config';
import { MeterProvider, PeriodicExportingMetricReader, PushMetricExporter } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import axios from 'axios';

const DEBUG_METRICS_ENDPOINT = 'http://localhost:3000/debug/metrics';

@Injectable()
export class AppService {

  private otelAvailable = false;
  public static metricsEnabled = false;
  private maxRetries = 5;
  private baseRetryDelay = 1000;
  private metricReader: PeriodicExportingMetricReader | null = null;
  private isRetrying = false; // ✅ Prevent multiple retries
  private maxRetriesReached = false; // ✅ Stop retries permanently

  public static meterProvider = new MeterProvider();
  private static meter = AppService.meterProvider.getMeter('nestjs-app');
  private static requestCount = AppService.meter.createCounter('custom_request_count', {
    description: 'Count of custom requests handled by the NestJS app',
  });

  constructor(private readonly httpService: HttpService) {
    this.checkOtelMetricsWithRetry();
  }

  private async isOtelMetricsAvailable(): Promise<boolean> {
    try {
      await axios.get(`${process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318'}/v1/metrics`);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkOtelMetricsWithRetry(attempt = 1) {
    if (this.isRetrying || this.maxRetriesReached) return; // ✅ Ensure only one retry runs
    this.isRetrying = true;

    if (attempt > this.maxRetries) {
      this.disableMetricsCollection();
      this.maxRetriesReached = true; // ✅ Stop further retries
      return;
    }

    const available = await this.isOtelMetricsAvailable();
    if (available) {
      this.otelAvailable = true;
      AppService.metricsEnabled = true;
      this.isRetrying = false; // ✅ Reset retry flag
      this.maxRetriesReached = false; // ✅ Allow future retries if needed
      if (winstonLogger) winstonLogger.info(`✅ OTEL Metrics available (Attempt ${attempt}).`);
      if (pinoLogger) pinoLogger.info(`✅ OTEL Metrics available (Attempt ${attempt}).`);
    } else {
      this.otelAvailable = false;
      AppService.metricsEnabled = false;

      if (attempt === this.maxRetries) {
        this.disableMetricsCollection();
        return;
      }

      const delay = this.baseRetryDelay * Math.pow(2, attempt);
      this.logError(`⚠️ OTEL Metrics unavailable. Retrying in ${delay / 1000}s (Attempt ${attempt}/${this.maxRetries})`);

      setTimeout(() => {
        this.isRetrying = false; // ✅ Reset retry flag before next retry
        this.checkOtelMetricsWithRetry(attempt + 1);
      }, delay);
    }
  }

  private disableMetricsCollection() {
    if (this.maxRetriesReached) return; // ✅ Prevent duplicate shutdown calls

    AppService.metricsEnabled = false;
    this.otelAvailable = false;
    this.maxRetriesReached = true; // ✅ Ensure retries stop permanently
    this.logError('❌ OTEL Metrics unavailable after retries. Stopping metrics collection.');

    if (this.metricReader) {
      this.metricReader.shutdown().then(() => {
        if (winstonLogger) winstonLogger.info('📉 Metrics collector stopped.');
        if (pinoLogger) pinoLogger.info('📉 Metrics collector stopped.');
      });
      this.metricReader = null;
    }

    this.createErrorEvent('otel_metrics_unavailable', 'OpenTelemetry Metrics Disabled');
  }

  private logError(message: string) {
    if (winstonLogger) winstonLogger.error(message);
    if (pinoLogger) pinoLogger.error(message);
  }

  private createErrorEvent(errorType: string, message: string) {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.addEvent('Error Event', { 'error.type': errorType, 'error.message': message });
    }
  }

  public async sendMetricsToDebugEndpoint(failedMetrics: any) {
    if (!AppService.metricsEnabled) return;
    try {
      await lastValueFrom(this.httpService.post(DEBUG_METRICS_ENDPOINT, { failedMetrics }));
      if (winstonLogger) winstonLogger.info('📤 Sent failed metrics to debug endpoint');
      if (pinoLogger) pinoLogger.info('📤 Sent failed metrics to debug endpoint');
    } catch (error) {
      this.logError(`❌ Failed to send metrics to debug endpoint: ${error.message}`);
    }
  }

  getHello(): string {

    if (winstonLogger) winstonLogger.info('getHello() called by Winston');
    if (pinoLogger) pinoLogger.info('getHello() called by Pino');

    const tracer = trace.getTracer('default');
    let activeSpan = trace.getActiveSpan();

    // 🚨 If no active span exists, create a new one manually
    if (!activeSpan) {
      if (winstonLogger) winstonLogger.warn('⚠️ No active span detected! Creating a new root span.');
      if (pinoLogger) pinoLogger.warn('⚠️ No active span detected! Creating a new root span.');

      activeSpan = tracer.startSpan('rootSpan-manual', {}, context.active());
      context.with(trace.setSpan(context.active(), activeSpan), () => {
        activeSpan?.setAttribute('auto-generated', 'true');
      });
    }

    if (activeSpan) {

      if (winstonLogger) winstonLogger.info('activeSpan ' + activeSpan);
      if (pinoLogger) pinoLogger.info('activeSpan ' + activeSpan);

      activeSpan.setAttribute('custom-tag', 'tag-value');
      activeSpan.setAttribute('operation', 'getHello');
      activeSpan.setAttribute('response', 'Goodbye Cruel World!');

      activeSpan.setAttribute('lumigo.execution_tags.execTag1', 'foo');
      activeSpan.setAttribute('lumigo.execution_tags.execTag2', 'bar');

    }

    const childSpan = tracer.startSpan('childSpan-example', {}, context.active());
    childSpan.setAttribute('processing-type', 'simple-text-return');
    childSpan.addEvent('CustomEvent: Start returning message');
    childSpan.end();

    // 🛠 Fix: Get attributes and events properly
    const getAttributes = (span: any) => (span?.attributes ? JSON.stringify(span.attributes, null, 2) : '{}');
    const getEvents = (span: any) => (span?.events ? JSON.stringify(span.events, null, 2) : '[]');

    // ✅ Generate Pretty HTML response
    const responseHTML = `
        <html>
        <head>
            <title>Trace Details</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; }
                .trace-container { border: 1px solid #ccc; padding: 15px; border-radius: 5px; background: white; }
                .trace-title { font-weight: bold; font-size: 22px; color: #333; }
                .trace-section { margin-bottom: 10px; }
                .trace-key { font-weight: bold; color: #007bff; }
                .trace-json { font-family: monospace; background: #eef; padding: 10px; border-radius: 5px; white-space: pre-wrap; }
            </style>
        </head>
        <body>
            <div class="trace-container">
                <div class="trace-title">OpenTelemetry Trace Details</div>
                <div class="trace-section">
                    <span class="trace-key">Trace ID:</span> ${activeSpan.spanContext().traceId}
                </div>
                <div class="trace-section">
                    <span class="trace-key">Span ID:</span> ${activeSpan.spanContext().spanId}
                </div>
                <div class="trace-section">
                    <span class="trace-key">Attributes:</span> 
                    <pre class="trace-json">${getAttributes(activeSpan)}</pre>
                </div>
                <div class="trace-section">
                    <span class="trace-key">Events:</span> 
                    <pre class="trace-json">${getEvents(activeSpan)}</pre>
                </div>
                <div class="trace-section">
                    <span class="trace-key">Child Span:</span>
                    <pre class="trace-json">
{
  "spanId": "${childSpan.spanContext().spanId}",
  "attributes": ${getAttributes(childSpan)},
  "events": ${getEvents(childSpan)}
}
                    </pre>
                </div>
            </div>
        </body>
        </html>
    `;

    activeSpan.end(); // End the active span
    return responseHTML;

  }
}

// ✅ Create OTEL metric exporter
const metricExporter = new OTLPMetricExporter({
  url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics',
  headers: { Authorization: `LumigoToken ${process.env.LUMIGO_TRACER_TOKEN}` },
});

// ✅ Wrapped OTEL exporter with error handling (Stops Metrics Only)
const wrappedExporter: PushMetricExporter = {
  async export(metrics: any, resultCallback: (result: any) => void) {
    const appService = new AppService(new HttpService());
    if (!AppService.metricsEnabled) {
      console.warn('⚠️ OTEL Metrics disabled. Skipping export.');
      return;
    }
    metricExporter.export(metrics, resultCallback);
  },
  async shutdown() {
    return metricExporter.shutdown();
  },
  async forceFlush() {
    return Promise.resolve();
  }
};

// ✅ Stop Metrics but Keep Tracing Active
// const metricReader = new PeriodicExportingMetricReader({
//   exporter: wrappedExporter,
//   exportIntervalMillis: 60000,
// });

// AppService.meterProvider.addMetricReader(metricReader);
