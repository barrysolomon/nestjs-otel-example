import { Injectable } from '@nestjs/common';
import { URLSearchParams } from 'url';
import { LogService } from './log.service';

@Injectable()
export class QueryParserService {
  constructor(private readonly logService: LogService) {}

  /**
   * Parses query parameters from a URL query string
   */
  parseQueryParams(queryString?: string): Record<string, any> {
    if (!queryString) return {};
    
    try {
      return Object.fromEntries(new URLSearchParams(queryString));
    } catch (error) {
      return {};
    }
  }

  /**
   * Extracts trace-related parameters from query params with defaults
   */
  extractTraceParams(queryParams: Record<string, any>): {
    message: string;
    customTag: string;
    operation: string;
    eventMessage: string;
    interval: number;
    autoGenerate: boolean;
  } {
    return {
      message: queryParams?.message || 'Goodbye Cruel World!',
      customTag: queryParams?.customTag || 'tag-value',
      operation: queryParams?.operation || 'getHello',
      eventMessage: queryParams?.event || 'CustomEvent: Start returning message',
      interval: queryParams?.interval ? parseInt(queryParams.interval) : 30000,
      autoGenerate: queryParams?.autoGenerate === 'true'
    };
  }

  /**
   * Extracts log-related parameters from query params with defaults
   */
  extractLogParams(queryParams: Record<string, any>): {
    logMessage: string;
    logSeverity: string;
  } {
    return {
      logMessage: queryParams?.logMessage || this.logService.getDefaultLogMessage(),
      logSeverity: queryParams?.logSeverity || 'info'
    };
  }
} 