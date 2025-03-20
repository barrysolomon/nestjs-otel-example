import { Injectable } from '@nestjs/common';
import { TraceService } from './services/trace.service';
import { TemplateService } from './services/template.service';
import { LogService } from './services/log.service';
import { QueryParserService } from './services/query-parser.service';

@Injectable()
export class AppService {
  constructor(
    private readonly traceService: TraceService,
    private readonly templateService: TemplateService,
    private readonly logService: LogService,
    private readonly queryParserService: QueryParserService
  ) {}

  /**
   * Main method to handle the hello endpoint with query parameters
   */
  getHello(queryString?: string): string {
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