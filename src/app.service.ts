import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { trace, context } from '@opentelemetry/api';
import { log } from './logger.config';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

@Injectable()
export class AppService {
  public static metricFailures = 0;
  public static maxMetricFailures = 5;
  public static monitoringInterval = 60000; // Check every 60 seconds
  public static lastSuccessfulExport = Date.now();
  public static metricsEnabled = true;

  public static meterProvider = new MeterProvider();
  private static meter = AppService.meterProvider.getMeter('nestjs-app');
  private static requestCount = AppService.meter.createCounter('custom_request_count', {
    description: 'Count of custom requests handled by the NestJS app',
  });

  constructor(private readonly httpService: HttpService) {
    this.startMetricMonitoring();
  }

  /**
   * Monitor metric exports and detect failures.
   */
  private startMetricMonitoring() {
    setInterval(() => {
      if (!AppService.metricsEnabled) return;

      const elapsedTime = Date.now() - AppService.lastSuccessfulExport;

      if (AppService.metricFailures >= AppService.maxMetricFailures) {
        this.logError(`🚨 Metrics are NOT being consumed! ${AppService.metricFailures} failures detected.`);
        this.disableMetricsCollection();
      } else if (elapsedTime > AppService.monitoringInterval) {
        log.warn(`⚠️ No successful metric exports detected in the last ${elapsedTime / 1000}s.`);
      }
    }, AppService.monitoringInterval);
  }

  /**
   * Increment custom request counter.
   */
  public recordRequest() {
    if (!AppService.metricsEnabled) return;
    AppService.requestCount.add(1);
  }

  /**
   * Disable metric collection after persistent failures.
   */
  private disableMetricsCollection() {
    if (!AppService.metricsEnabled) return;
    AppService.metricsEnabled = false;
    log.error('❌ Persistent metric failures detected. Stopping metrics collection.');
  }

  /**
   * Log errors to both Winston and Pino.
   */
  private logError(message: string) {
    log?.error(message);
  }

  getHello(): string {

    log.info('getHello() called');
  
    const tracer = trace.getTracer('default');
    let activeSpan = trace.getActiveSpan();
  
    // 🚨 If no active span exists, create a new one manually
    if (!activeSpan) {
      log.warn('⚠️ No active span detected! Creating a new root span.');
      activeSpan = tracer.startSpan('rootSpan-manual', {}, context.active());
      context.with(trace.setSpan(context.active(), activeSpan), () => {
        activeSpan?.setAttribute('auto-generated', 'true');
      });
    }
  
    if (activeSpan) {
  
      log.info('activeSpan ' + activeSpan);
  
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

// ✅ Custom Metric Reader to Track Failures
class MonitoringMetricReader extends PeriodicExportingMetricReader {
  async _export(metrics: any) {
    return new Promise((resolve) => {
      metricExporter.export(metrics, (result) => {
        if (result.code !== 0) {
          AppService.metricFailures++;
          log.error(`❌ Metric export failed (${AppService.metricFailures}/${AppService.maxMetricFailures}).`);
        } else {
          AppService.metricFailures = 0;
          AppService.lastSuccessfulExport = Date.now();
          log.info('✅ Metrics successfully exported.');
        }
        resolve(result);
      });
    });
  }
}

// ✅ OTEL Metric Exporter with Failure Tracking
const metricExporter = new OTLPMetricExporter({
  url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || "https://ga-otlp.lumigo-tracer-edge.golumigo.com/v1/metrics",
  headers: { Authorization: `LumigoToken ${process.env.LUMIGO_TRACER_TOKEN}` },
});

// ✅ Attach custom metric reader with monitoring
const metricReader = new MonitoringMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 60000,
});

AppService.meterProvider.addMetricReader(metricReader);
