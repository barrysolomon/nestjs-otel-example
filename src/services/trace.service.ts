import { Injectable } from '@nestjs/common';
import { trace, context, Span, SpanStatusCode } from '@opentelemetry/api';
import { log } from '../logger.config';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class TraceService {
  private traceHistory: any[] = [];
  private readonly TRACE_FILE_PATH = process.env.TRACE_STORAGE_PATH || join(process.cwd(), 'traces-storage.json');

  constructor() {
    // Try to load traces from the file if it exists
    console.log(`TraceService initialized with storage path: ${this.TRACE_FILE_PATH}`);
    this.loadTracesFromFile();
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
      } else {
        console.log('No traces storage file found, starting with empty trace history');
      }
    } catch (error) {
      console.error('Error loading traces from file:', error);
    }
  }

  /**
   * Save traces to file
   */
  private saveTracesToFile() {
    try {
      fs.writeFileSync(this.TRACE_FILE_PATH, JSON.stringify(this.traceHistory.slice(0, 1000)), 'utf8');
    } catch (error) {
      console.error('Error saving traces to file:', error);
    }
  }

  /**
   * Generate a trace with the provided parameters
   */
  generateTrace(message: string, customTag?: string, operationName: string = 'custom-operation', eventMessage?: string): any {
    const tracer = trace.getTracer('default-tracer');
    const operationToUse = operationName || 'custom-operation';
    
    const result = { traceId: '', message: message, status: 'success' };
    
    // Create and record a span
    const span = tracer.startSpan(operationToUse);
    
    try {
      // Set span attributes
      if (message) {
        span.setAttribute('message', message);
      }
      
      if (customTag) {
        const [key, value] = customTag.split('=');
        if (key && value) {
          span.setAttribute(key, value);
        }
      }
      
      // Add an event to the span if provided
      if (eventMessage) {
        span.addEvent(eventMessage);
      }
      
      // Record trace ID
      result.traceId = span.spanContext().traceId;
      
      // Store the trace
      this.storeTrace(span, message, operationToUse);
      
      log.info(`Generated trace with ID: ${result.traceId}, operation: ${operationToUse}`);
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      result.status = 'error';
      result.message = `Error generating trace: ${error.message}`;
      log.error(`Error generating trace: ${error.message}`);
    } finally {
      // End the span
      span.end();
    }
    
    return result;
  }

  /**
   * Store a trace in history
   */
  storeTrace(span: Span, message: string, operation: string) {
    // Get trace and span IDs
    const context = span.spanContext();
    const traceId = context.traceId;
    const spanId = context.spanId;
    
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
      status: Math.random() > 0.9 ? 'error' : 'success' // 10% chance of error for simulation
    };
    
    // Add to history
    this.traceHistory.unshift(traceData);
    
    // Keep only the last 1000 traces
    if (this.traceHistory.length > 1000) {
      this.traceHistory = this.traceHistory.slice(0, 1000);
    }
    
    // Save to file every 10 traces
    if (this.traceHistory.length % 10 === 0) {
      this.saveTracesToFile();
    }
    
    // Debug trace count
    if (this.traceHistory.length % 10 === 0) {
      console.log(`Trace history now contains ${this.traceHistory.length} entries`);
    }
    
    return traceData;
  }

  /**
   * Get trace history
   */
  getTraceHistory() {
    return this.traceHistory;
  }

  /**
   * Safely get attributes from a span
   */
  getAttributes(span: Span): Record<string, any> {
    try {
      // This is a workaround as attributes are not directly accessible
      // In a real app, you would use a proper way to access span attributes
      return {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Safely get events from a span
   */
  getEvents(span: Span): any[] {
    try {
      // This is a workaround as events are not directly accessible
      // In a real app, you would use a proper way to access span events
      return [];
    } catch (error) {
      return [];
    }
  }
} 