import { Injectable } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { log } from '../logger.config';

@Injectable()
export class TraceService {
  private traceInterval: NodeJS.Timeout | null = null;

  /**
   * Generates a trace with the provided parameters
   */
  generateTrace(message: string, customTag: string, operation: string, eventMessage: string) {
    log.info(`Generating trace with message: ${message}`);

    const tracer = trace.getTracer('default');
    const activeSpan = tracer.startSpan(operation, {
      attributes: {
        'custom-tag': customTag,
        'operation': operation,
        'response': message
      }
    });

    // Add event to the span
    activeSpan.addEvent(eventMessage);

    log.info(`📌 Active Span Created - Trace ID: ${activeSpan.spanContext().traceId}`);

    activeSpan.end();
    return activeSpan;
  }

  /**
   * Helper method to safely retrieve span attributes
   */
  getAttributes(span: any): string {
    return span?.attributes ? JSON.stringify(span.attributes, null, 2) : '{}';
  }

  /**
   * Helper method to safely retrieve span events
   */
  getEvents(span: any): string {
    return span?.events ? JSON.stringify(span.events, null, 2) : '[]';
  }
} 