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

    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {      // Set custom attributes on the active span
      activeSpan.setAttribute('custom-tag', 'tag-value');
      activeSpan.setAttribute('operation', 'getHello');
      activeSpan.setAttribute('response', 'Goodbye Cruel World!');

      activeSpan.setAttribute('lumigo.execution_tags.execTag1', 'foo');
      trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.execTag2', 'bar');
    }

    // Correct way to propagate the parent span using context
    const tracer = trace.getTracer('default');
    const childSpan = tracer.startSpan('childSpan-example', {}, context.active());

    // Add some attributes to the child span
    childSpan.setAttribute('processing-type', 'simple-text-return');
    childSpan.addEvent('CustomEvent: Start returning message');

    // End the child span
    childSpan.end();

    if (AppService.metricsEnabled) {
      AppService.requestCount.add(1, { operation: 'getHello' });
    }

    return 'Goodbye Cruel World!';
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
