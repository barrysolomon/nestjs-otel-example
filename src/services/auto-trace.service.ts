import { Injectable, OnApplicationBootstrap, OnApplicationShutdown, Logger } from '@nestjs/common';
import { TraceService } from './trace.service';
import { log } from '../logger.config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Types of trace operations to generate
 */
enum TraceType {
  API_REQUEST = 'api_request',
  DATABASE_QUERY = 'database_query',
  USER_ACTION = 'user_action',
  BACKGROUND_JOB = 'background_job',
  MICROSERVICE_CALL = 'microservice_call',
  EXTERNAL_API = 'external_api'
}

/**
 * Service that can automatically generate traces periodically.
 * Internally uses the trace.service to store traces.
 */
@Injectable()
export class AutoTraceService implements OnApplicationBootstrap, OnApplicationShutdown {
  autoTraceEnabled = false;
  autoTraceTimeoutMs = 1000;

  errorPercent = 20;
  autoTraceTimeout: NodeJS.Timeout = null;

  services = [
    'customer-service',
    'order-service',
    'payment-service',
    'inventory-service',
    'shipping-service',
  ];

  operations = {
    'customer-service': [
      'getCustomer',
      'createCustomer',
      'updateCustomer',
      'authenticate',
    ],
    'order-service': ['getOrder', 'createOrder', 'updateOrder', 'cancelOrder'],
    'payment-service': ['processPayment', 'refundPayment', 'getPaymentDetails'],
    'inventory-service': [
      'checkStock',
      'reserveItem',
      'releaseItem',
      'updateInventory',
    ],
    'shipping-service': [
      'calculateShipping',
      'createShipment',
      'trackShipment',
      'updateShipment',
    ],
  };

  private enabled = false;
  private interval: NodeJS.Timeout;
  private timeoutMs = 5000;
  private readonly logger = new Logger(AutoTraceService.name);
  private lastOperation = 'default-operation';
  private errorRate = 0.1; // 10% error rate
  private currentTraceId: string = null;
  private configPath = path.join(process.cwd(), 'auto-trace-config.json');

  constructor(private readonly traceService: TraceService, private readonly eventEmitter: EventEmitter2) {
    // Initialize with stored state if available
    try {
      if (fs.existsSync(this.configPath)) {
        const storedState = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        this.enabled = storedState.enabled || false;
        this.timeoutMs = storedState.timeoutMs || 5000;
        this.errorRate = storedState.errorRate || 0.1;
        this.autoTraceEnabled = this.enabled;
        this.autoTraceTimeoutMs = this.timeoutMs;
        this.errorPercent = this.errorRate * 100;
      }
    } catch (e) {
      // Ignore errors if file is not available or invalid
      this.logger.debug('Config file not available, using default auto-trace settings');
    }

    if (this.enabled) {
      this.startAutoTrace();
    }
  }

  onApplicationBootstrap() {
    if (this.autoTraceEnabled) {
      this.startGeneratingTraces();
    }
  }

  onApplicationShutdown() {
    this.stopGeneratingTraces();
  }

  startGeneratingTraces() {
    this.logger.debug(`Starting trace generation - enabled: ${this.autoTraceEnabled}, timeout: ${this.autoTraceTimeoutMs}ms`);
    this.autoTraceEnabled = true;
    this.startAutoTraceTimeout();
  }

  stopGeneratingTraces() {
    this.logger.debug(`Stopping trace generation - was enabled: ${this.autoTraceEnabled}`);

    this.autoTraceEnabled = false;
    if (this.autoTraceTimeout) {
      clearTimeout(this.autoTraceTimeout);
      this.autoTraceTimeout = null;
    }
  }

  setAutoTraceTimeoutMs(timeoutMs: number) {
    if (isNaN(timeoutMs) || timeoutMs < 100) {
      return;
    }

    this.logger.debug(`Setting new auto-trace timeout: ${timeoutMs}ms`);

    this.autoTraceTimeoutMs = timeoutMs;
    if (this.autoTraceEnabled) {
      this.startAutoTraceTimeout();
    }
    this.timeoutMs = timeoutMs;
    this.saveState();
  }

  setErrorPercent(errorPercent: number) {
    if (isNaN(errorPercent) || errorPercent < 0 || errorPercent > 100) {
      return;
    }

    this.logger.debug(`Setting error percent: ${errorPercent}%`);

    this.errorPercent = errorPercent;
    this.errorRate = errorPercent / 100;
    this.saveState();
  }

  private saveState(): void {
    try {
      const state = {
        enabled: this.enabled,
        timeoutMs: this.timeoutMs,
        errorRate: this.errorRate,
      };
      fs.writeFileSync(this.configPath, JSON.stringify(state, null, 2));
      this.logger.debug(`Auto-trace state saved to ${this.configPath}`);
    } catch (e) {
      this.logger.error(`Failed to save auto-trace state: ${e.message}`);
    }
  }

  private startAutoTraceTimeout() {
    if (this.autoTraceTimeout) {
      clearTimeout(this.autoTraceTimeout);
      this.autoTraceTimeout = null;
    }

    // create timeout
    this.autoTraceTimeout = setTimeout(() => {
      this.generateRandomTrace();

      // schedule next trace
      if (this.autoTraceEnabled) {
        this.startAutoTraceTimeout();
      }
    }, this.autoTraceTimeoutMs);
  }

  private generateRandomTrace() {
    try {
      this.logger.debug('Generating random trace');

      const isError = Math.random() < this.errorPercent / 100;
      const serviceName = this.pickRandom(this.services);
      const operationName = this.pickRandom(
        this.operations[serviceName] || ['operation'],
      ) as string;

      const traceId = crypto.randomBytes(16).toString('hex');
      const spanId = crypto.randomBytes(8).toString('hex');
      const parentSpanId = crypto.randomBytes(8).toString('hex');

      // create trace + span
      const traceExternalCall = Math.random() > 0.5;

      // random duration between 5 and 500ms
      const duration = Math.floor(Math.random() * 495) + 5;
      const timestamp = Date.now();
      const payload = {
        operation: operationName,
        message: `${operationName} operation on ${serviceName}`,
      };

      this.logger.debug(`Auto-generating trace: ${serviceName}.${operationName} (error: ${isError}, external: ${traceExternalCall}, duration: ${duration}ms)`);

      const trace = {
        id: `trace_${timestamp}_${Math.floor(Math.random() * 1000)}`,
        traceId,
        spanId,
        parentSpanId: traceExternalCall ? parentSpanId : null,
        operation: operationName,
        name: operationName,
        message: `${operationName} operation on ${serviceName}`,
        serviceName,
        kind: 'SERVER',
        timestamp: new Date(timestamp).toISOString(),
        startTime: new Date(timestamp).toISOString(),
        endTime: new Date(timestamp + duration).toISOString(),
        durationMs: duration,
        attributes: {
          'service.name': serviceName,
          'operation.name': operationName,
          'request.method': 'POST',
          'request.path': `/${serviceName}/${operationName}`,
          duration: duration + 'ms',
        },
        status: isError ? 'ERROR' : 'OK',
        events: isError
          ? [
              {
                name: 'exception',
                time: new Date(timestamp + Math.floor(duration / 2)).toISOString(),
                attributes: {
                  'exception.type': this.pickRandom([
                    'ValidationError',
                    'TimeoutError',
                    'DatabaseError',
                    'AuthenticationError',
                  ]),
                  'exception.message': `Error during ${operationName} operation`,
                  'exception.stacktrace': `Error: Error during ${operationName} operation\n    at ${serviceName}.${operationName} (${serviceName}.js:123:45)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
                },
              },
            ]
          : [],
      };

      // Store trace via the trace service - pass null for span since we're creating synthetic traces
      this.traceService.storeTrace(null, trace.message, trace.operation);

      // for debugging purposes
      console.log('Generated trace payload:', JSON.stringify(payload));

      // Emit an event with the generated trace
      this.eventEmitter.emit('trace.generated', trace);
    } catch (error) {
      console.error('Error in auto-trace generation:', error);
    }
  }

  private pickRandom<T>(items: T[]): T {
    if (!items || items.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * items.length);
    if (!items[randomIndex]) {
      return items[0]; // Fallback
    }
    return items[randomIndex];
  }

  setEnabled(enabled: boolean): void {
    this.logger.debug(`Auto trace service ${enabled ? 'enabled' : 'disabled'}`);
    this.enabled = enabled;
    this.autoTraceEnabled = enabled;
    if (enabled) {
      this.startGeneratingTraces();
    } else {
      this.stopGeneratingTraces();
    }
    this.saveState();
  }

  setTimeoutMs(timeoutMs: number): void {
    this.timeoutMs = timeoutMs;
    this.setAutoTraceTimeoutMs(timeoutMs);
    this.logger.debug(`Auto trace timeout set to ${timeoutMs}ms`);
    this.saveState();
  }

  setErrorRate(rate: number): void {
    if (rate >= 0 && rate <= 1) {
      this.errorRate = rate;
      this.setErrorPercent(rate * 100);
      this.logger.debug(`Auto trace error rate set to ${rate * 100}%`);
      this.saveState();
    }
  }

  getState(): { enabled: boolean; timeoutMs: number; errorRate: number } {
    return {
      enabled: this.enabled,
      timeoutMs: this.timeoutMs,
      errorRate: this.errorRate,
    };
  }

  private startAutoTrace(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.logger.debug(`Starting auto trace with interval ${this.timeoutMs}ms`);
    this.startGeneratingTraces();
  }

  private stopAutoTrace(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.stopGeneratingTraces();
    this.logger.debug('Auto trace stopped');
  }

  private restartAutoTrace(): void {
    this.stopAutoTrace();
    this.startAutoTrace();
  }

  private getRandomOperation(): string {
    const randomIndex = Math.floor(Math.random() * this.operations[this.getRandomService()].length);
    this.lastOperation = this.operations[this.getRandomService()][randomIndex];
    return this.lastOperation;
  }

  private getRandomService(): string {
    const randomIndex = Math.floor(Math.random() * this.services.length);
    return this.services[randomIndex];
  }
} 