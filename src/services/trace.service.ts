import { Injectable } from '@nestjs/common';
import { Span, SpanKind, trace, SpanStatusCode, context } from '@opentelemetry/api';
import { log } from '../logger.config';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class TraceService {
  private traceHistory: any[] = [];
  private readonly TRACE_FILE_PATH = process.env.TRACE_STORAGE_PATH || join(process.cwd(), 'trace-storage.json');
  private readonly MAX_HISTORY_SIZE = 1000; // Maximum number of traces to keep in memory
  private readonly MAX_AGE_DAYS = 7; // Maximum age for stored traces (7 days)
  
  // Running tallies for statistics
  private totalTraceCount = 0;
  private totalTracesPerOperation: Record<string, number> = {};
  private totalTracesPerService: Record<string, number> = {};
  private totalTracesPerDay: Record<string, number> = {};
  private statsLastReset = new Date().toISOString();

  constructor() {
    // Try to load traces from the file if it exists
    console.log(`TraceService initialized with storage path: ${this.TRACE_FILE_PATH}`);
    this.loadTracesFromFile();
    this.loadStatsFromFile();
  }

  /**
   * Load traces from the file if it exists
   */
  private loadTracesFromFile() {
    try {
      if (fs.existsSync(this.TRACE_FILE_PATH)) {
        const fileData = fs.readFileSync(this.TRACE_FILE_PATH, 'utf8');
        this.traceHistory = JSON.parse(fileData);
        console.log(`Loaded ${this.traceHistory.length} traces from storage file`);
        
        // Perform date-based pruning after loading
        this.pruneOldTraces();
      } else {
        console.log('No trace storage file found, starting with empty trace history');
      }
    } catch (error) {
      console.error('Error loading traces from file:', error);
    }
  }

  /**
   * Load statistics from file
   */
  private loadStatsFromFile() {
    try {
      const statsFilePath = this.TRACE_FILE_PATH.replace('.json', '-stats.json');
      if (fs.existsSync(statsFilePath)) {
        const fileData = fs.readFileSync(statsFilePath, 'utf8');
        const stats = JSON.parse(fileData);
        this.totalTraceCount = stats.totalTraceCount || 0;
        this.totalTracesPerOperation = stats.totalTracesPerOperation || {};
        this.totalTracesPerService = stats.totalTracesPerService || {};
        this.totalTracesPerDay = stats.totalTracesPerDay || {};
        this.statsLastReset = stats.statsLastReset || new Date().toISOString();
        console.log(`Loaded trace statistics: ${this.totalTraceCount} total traces`);
      }
    } catch (error) {
      console.error('Error loading trace statistics:', error);
    }
  }

  /**
   * Save traces to file
   */
  private saveTracesToFile() {
    try {
      fs.writeFileSync(this.TRACE_FILE_PATH, JSON.stringify(this.traceHistory), 'utf8');
      
      // Save statistics to a separate file
      const statsFilePath = this.TRACE_FILE_PATH.replace('.json', '-stats.json');
      const stats = {
        totalTraceCount: this.totalTraceCount,
        totalTracesPerOperation: this.totalTracesPerOperation,
        totalTracesPerService: this.totalTracesPerService,
        totalTracesPerDay: this.totalTracesPerDay,
        statsLastReset: this.statsLastReset
      };
      fs.writeFileSync(statsFilePath, JSON.stringify(stats), 'utf8');
    } catch (error) {
      console.error('Error saving traces to file:', error);
    }
  }

  /**
   * Remove traces older than MAX_AGE_DAYS
   */
  private pruneOldTraces() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.MAX_AGE_DAYS);
    
    const originalLength = this.traceHistory.length;
    this.traceHistory = this.traceHistory.filter(trace => {
      try {
        const traceDate = new Date(trace.timestamp);
        return traceDate >= cutoffDate;
      } catch (e) {
        return true; // Keep traces with invalid dates
      }
    });
    
    const prunedCount = originalLength - this.traceHistory.length;
    if (prunedCount > 0) {
      console.log(`Pruned ${prunedCount} traces older than ${this.MAX_AGE_DAYS} days`);
      this.saveTracesToFile();
    }
  }

  /**
   * Update the running statistics
   */
  private updateStatistics(traceData: any) {
    // Increment total count
    this.totalTraceCount++;
    
    // Increment operation count
    if (traceData.operation) {
      this.totalTracesPerOperation[traceData.operation] = 
        (this.totalTracesPerOperation[traceData.operation] || 0) + 1;
    }
    
    // Increment service count
    if (traceData.serviceName) {
      this.totalTracesPerService[traceData.serviceName] = 
        (this.totalTracesPerService[traceData.serviceName] || 0) + 1;
    }
    
    // Increment daily count
    const day = traceData.timestamp.split('T')[0]; // YYYY-MM-DD
    this.totalTracesPerDay[day] = (this.totalTracesPerDay[day] || 0) + 1;
  }

  /**
   * Generate a new trace with the given operation name
   */
  generateTrace(operationName: string): any {
    try {
      console.log(`Generating trace for operation: ${operationName}`);
      const tracer = trace.getTracer('nestjs-tracer');

      const options = {
        kind: SpanKind.SERVER
      };

      // Start a new span for this operation
      const span = tracer.startSpan(operationName, options);

      // Add some attributes
      span.setAttribute('app.synthetic', true);
      span.setAttribute('app.timestamp', Date.now());

      // Extract operation type from operationName
      const hasDatabase = operationName.includes('database');
      const hasHttp = operationName.includes('http');
      const hasError = operationName.includes('error');

      // Generate different attributes based on operation
      if (hasDatabase) {
        span.setAttribute('db.system', 'postgresql');
        span.setAttribute('db.statement', 'SELECT * FROM users WHERE id = ?');
        span.setAttribute('db.user', 'db_user');

        // Add a nested span for the database query
        const querySpan = tracer.startSpan('database.query', {
          kind: SpanKind.CLIENT
        }, trace.setSpan(context.active(), span));
        querySpan.setAttribute('db.operation', 'SELECT');
        
        // Random delay between 5-20ms
        const delay = Math.floor(Math.random() * 15) + 5;
        setTimeout(() => {
          querySpan.end();
        }, delay);
      }
      else if (hasHttp) {
        span.setAttribute('http.method', 'GET');
        span.setAttribute('http.url', 'https://api.example.com/data');
        span.setAttribute('http.status_code', 200);
        
        // Add a nested span for the HTTP request
        const httpSpan = tracer.startSpan('http.request', {
          kind: SpanKind.CLIENT
        }, trace.setSpan(context.active(), span));
        httpSpan.setAttribute('http.request_content_length', 256);
        httpSpan.setAttribute('http.response_content_length', 1024);
        
        // Random delay between 30-100ms
        const delay = Math.floor(Math.random() * 70) + 30;
        setTimeout(() => {
          httpSpan.end();
        }, delay);
      }
      else if (hasError) {
        // Generate an error trace
        span.setAttribute('error', true);
        span.setAttribute('exception.message', 'Simulated error for testing');
        span.setAttribute('exception.type', 'SimulatedError');
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Operation failed with simulated error'
        });
      }
      
      // Random delay between 50-200ms for the main span
      const delay = Math.floor(Math.random() * 150) + 50;
      setTimeout(() => {
        // End the span after the delay
        span.end();
        console.log(`Generated trace for operation: ${operationName}, delay: ${delay}ms`);
      }, delay);
      
      // Get the message from operation name if present
      const message = operationName.split('_').slice(1).join(' ') || operationName;
      
      // Return information about the trace
      const traceInfo = {
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
        operation: operationName,
        synthetic: true,
        durationMs: delay,
        timestamp: new Date().toISOString(),
        status: hasError ? 'error' : 'success'
      };
      
      // Store trace data
      const storedTrace = this.storeTrace(span, message, operationName);
      
      // Ensure we return consistent trace ID with what's stored
      return {
        ...traceInfo,
        traceId: storedTrace.traceId
      };
    } catch (error) {
      console.error('Error generating trace:', error);
      throw error;
    }
  }

  /**
   * Get span attributes
   */
  getAttributes(span: Span | null): Record<string, string> {
    const attributes: Record<string, string> = {};
    
    if (!span) {
      return {
        'span.type': 'external',
        'span.external': 'true'
      };
    }
    
    try {
      // In a real implementation, we would extract actual attributes from the span
      // For this example, we'll generate some sample attributes
      attributes['span.kind'] = 'server';
      attributes['service.name'] = 'nestjs-opentelemetry-example';
      
      // Random HTTP attributes
      if (Math.random() > 0.5) {
        attributes['http.method'] = 'GET';
        attributes['http.url'] = 'https://api.example.com/data';
        attributes['http.status_code'] = '200';
      } else {
        attributes['db.system'] = 'postgresql';
        attributes['db.operation'] = 'SELECT';
        attributes['db.statement'] = 'SELECT * FROM users WHERE id = ?';
      }
    } catch (error) {
      console.error('Error getting span attributes:', error);
      attributes['error.getting.attributes'] = 'true';
    }
    
    return attributes;
  }
  
  /**
   * Get span events
   */
  getEvents(span: Span | null): any[] {
    const events: any[] = [];
    
    if (!span) {
      return [{
        name: 'external.trace',
        timestamp: new Date().toISOString(),
        attributes: {
          'external': 'true'
        }
      }];
    }
    
    try {
      // In a real implementation, we would extract actual events from the span
      // For this example, we'll generate some sample events
      
      // Add 1-3 random events
      const eventCount = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < eventCount; i++) {
        const eventTime = new Date();
        // Add a random offset (0-500ms)
        eventTime.setMilliseconds(eventTime.getMilliseconds() + Math.floor(Math.random() * 500));
        
        events.push({
          name: ['start', 'process', 'complete'][i % 3],
          timestamp: eventTime.toISOString(),
          attributes: {
            'event.id': `evt_${Date.now()}_${i}`,
            'event.sequence': i.toString()
          }
        });
      }
    } catch (error) {
      console.error('Error getting span events:', error);
      events.push({
        name: 'error.getting.events',
        timestamp: new Date().toISOString(),
        attributes: {
          'error': 'true',
          'error.message': error.message
        }
      });
    }
    
    return events;
  }

  /**
   * Store a trace in history
   */
  storeTrace(span: Span | null, message: string, operation: string = 'unknown') {
    try {
      let traceId = '';
      let spanId = '';
      
      // Get trace and span IDs if span is available
      if (span) {
        try {
          const context = span.spanContext();
          traceId = context.traceId;
          spanId = context.spanId;
        } catch (spanError) {
          console.error('Error getting span context:', spanError);
          // Generate random IDs instead
          traceId = `trace_${Date.now().toString(16)}_${Math.random().toString(16).substring(2, 10)}`;
          spanId = `span_${Date.now().toString(16)}_${Math.random().toString(16).substring(2, 10)}`;
        }
      } else {
        // Generate random IDs for external traces without span
        traceId = `trace_${Date.now().toString(16)}_${Math.random().toString(16).substring(2, 10)}`;
        spanId = `span_${Date.now().toString(16)}_${Math.random().toString(16).substring(2, 10)}`;
      }
      
      // Generate random duration between 10ms and 200ms for simulation
      const durationMs = Math.floor(Math.random() * 190) + 10;
      
      // Create trace data
      const traceData = {
        id: `trace_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        traceId,
        spanId,
        operation,
        message,
        timestamp: new Date().toISOString(),
        durationMs,
        attributes: this.getAttributes(span),
        events: this.getEvents(span),
        serviceName: 'nestjs-opentelemetry-example',
        status: operation.includes('error') ? 'error' : 'success'
      };
      
      // Update statistics
      this.updateStatistics(traceData);
      
      // Add to history using queue approach (oldest traces at the end)
      this.traceHistory.unshift(traceData);
      
      // Apply size limit to history
      if (this.traceHistory.length > this.MAX_HISTORY_SIZE) {
        this.traceHistory.pop(); // Remove oldest trace (from the end)
      }
      
      // Periodically run date-based pruning (every 100 traces)
      if (this.totalTraceCount % 100 === 0) {
        this.pruneOldTraces();
      }
      
      // Periodically save to file (every 50 traces)
      if (this.totalTraceCount % 50 === 0) {
        this.saveTracesToFile();
      }

      // Return the created trace object
      return traceData;
    } catch (error) {
      console.error('Error storing trace:', error);
      // Create a minimal trace object in case of error
      return {
        id: `error_trace_${Date.now()}`,
        traceId: `error_${Date.now().toString(16)}`,
        spanId: `error_${Date.now().toString(16)}`,
        operation,
        message: `Error storing trace: ${message}`,
        timestamp: new Date().toISOString(),
        durationMs: 0,
        attributes: { error: 'true' },
        events: [{
          name: 'error',
          timestamp: new Date().toISOString(),
          attributes: { error: 'true' }
        }],
        serviceName: 'nestjs-opentelemetry-example',
        status: 'error'
      };
    }
  }

  /**
   * Get trace history
   */
  getTraceHistory() {
    return this.traceHistory;
  }
  
  /**
   * Get trace statistics
   */
  getTraceStatistics() {
    return {
      totalTraces: this.totalTraceCount,
      storedTraces: this.traceHistory.length,
      tracesPerOperation: this.totalTracesPerOperation,
      tracesPerService: this.totalTracesPerService,
      tracesPerDay: this.totalTracesPerDay,
      statsLastReset: this.statsLastReset
    };
  }

  /**
   * Reset trace statistics
   */
  resetTraceStatistics() {
    this.totalTraceCount = this.traceHistory.length;
    this.totalTracesPerOperation = {};
    this.totalTracesPerService = {};
    this.totalTracesPerDay = {};
    this.statsLastReset = new Date().toISOString();
    
    // Rebuild statistics from current traces
    this.traceHistory.forEach(trace => {
      if (trace.operation) {
        this.totalTracesPerOperation[trace.operation] = 
          (this.totalTracesPerOperation[trace.operation] || 0) + 1;
      }
      
      if (trace.serviceName) {
        this.totalTracesPerService[trace.serviceName] = 
          (this.totalTracesPerService[trace.serviceName] || 0) + 1;
      }
      
      if (trace.timestamp) {
        const day = trace.timestamp.split('T')[0]; // YYYY-MM-DD
        this.totalTracesPerDay[day] = (this.totalTracesPerDay[day] || 0) + 1;
      }
    });
    
    this.saveTracesToFile();
    return this.getTraceStatistics();
  }
} 