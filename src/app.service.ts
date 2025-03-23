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
   * Generate a trace with the given parameters
   */
  generateTrace(message?: string, customTag?: string, operation?: string, eventMessage?: string) {
    // Increment the counter
    this.counter.add(1, { 'endpoint': 'generateTrace' });
    
    log.info('Trace API called');
    
    // Set default values
    message = message || 'Hello World';
    customTag = customTag || 'default-tag';
    operation = operation || 'default-operation';
    eventMessage = eventMessage || 'Event message';
    
    // Generate trace with operation only
    const operationWithContext = `${operation}_${customTag}_${message.substring(0, 10)}`;
    const result = this.traceService.generateTrace(operationWithContext);

    return {
      traceId: result.traceId,
      message,
      customTag,
      operation,
      eventMessage,
      status: result.status
    };
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
    const operationWithContext = `${traceParams.operation}_${traceParams.customTag}_${traceParams.message.substring(0, 10)}`;
    const result = this.traceService.generateTrace(operationWithContext);

    // Generate HTML UI
    return this.templateService.generateTraceEditorUI(
      result.traceId,
      'span-id-unknown',  // spanId is no longer available in our new implementation
      traceParams.message,
      traceParams.customTag,
      traceParams.operation,
      traceParams.eventMessage,
      JSON.stringify({}, null, 2),  // attributes as formatted JSON
      JSON.stringify([], null, 2),  // events as formatted JSON
      traceParams.interval,
      traceParams.autoGenerate,
      logParams.logMessage,
      logParams.logSeverity
    );
  }
}