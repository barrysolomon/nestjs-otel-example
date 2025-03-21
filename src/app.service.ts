import { Injectable } from '@nestjs/common';
import { TraceService } from './services/trace.service';
import { TemplateService } from './services/template.service';
import { LogService } from './services/log.service';
import { QueryParserService } from './services/query-parser.service';
import { metrics } from '@opentelemetry/api';
import { log } from './logger.config';

@Injectable()
export class AppService {
  private counter;

  constructor(
    private readonly traceService: TraceService,
    private readonly templateService: TemplateService,
    private readonly logService: LogService,
    private readonly queryParserService: QueryParserService
  ) {
    // Create a meter
    const meter = metrics.getMeter('default');
    
    // Create a counter for API calls
    this.counter = meter.createCounter('api.calls', {
      description: 'Counts the number of API calls',
    });
  }

  /**
   * Main method to handle the hello endpoint with query parameters
   */
  getHello(queryString?: string): string {
    // Increment the counter
    this.counter.add(1, { 'endpoint': 'getHello' });
    
    log.info('Hello API called');
    
    // Parse query parameters
    const queryParams = this.queryParserService.parseQueryParams(queryString);
    
    // Extract trace and log parameters with defaults
    const traceParams = this.queryParserService.extractTraceParams(queryParams);
    const logParams = this.queryParserService.extractLogParams(queryParams);
    
    // Generate trace
    const activeSpan = this.traceService.generateTrace(
      traceParams.message,
      traceParams.customTag,
      traceParams.operation,
      traceParams.eventMessage
    );

    // Generate HTML UI
    return this.templateService.generateTraceEditorUI(
      activeSpan.spanContext().traceId,
      activeSpan.spanContext().spanId,
      traceParams.message,
      traceParams.customTag,
      traceParams.operation,
      traceParams.eventMessage,
      this.traceService.getAttributes(activeSpan),
      this.traceService.getEvents(activeSpan),
      traceParams.interval,
      traceParams.autoGenerate,
      logParams.logMessage,
      logParams.logSeverity
    );
  }
}