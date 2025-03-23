import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { TraceService } from './trace.service';
import { log } from '../logger.config';

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
 * Service that automatically generates random traces with different operations and attributes
 */
@Injectable()
export class AutoTraceService implements OnApplicationBootstrap, OnApplicationShutdown {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly TRACE_INTERVAL_MS = 3000; // Generate traces every 3 seconds
  
  // Weights for random distribution - higher numbers mean more frequent occurrence
  private readonly TRACE_TYPE_WEIGHTS = {
    [TraceType.API_REQUEST]: 10,
    [TraceType.DATABASE_QUERY]: 8,
    [TraceType.USER_ACTION]: 6,
    [TraceType.BACKGROUND_JOB]: 4,
    [TraceType.MICROSERVICE_CALL]: 5,
    [TraceType.EXTERNAL_API]: 3
  };

  constructor(private readonly traceService: TraceService) {}

  /**
   * Start generating traces when the application starts, but don't auto-start
   */
  onApplicationBootstrap() {
    log.info('Auto Trace Service initialized');
    // We don't auto-start unlike the Logger
  }

  /**
   * Stop generating traces when the application shuts down
   */
  onApplicationShutdown() {
    this.stopTraceGeneration();
    log.info('Auto Trace Service stopped');
  }

  /**
   * Check if the auto-tracer is currently running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Get the current interval in milliseconds
   */
  getInterval(): number {
    return this.TRACE_INTERVAL_MS;
  }

  /**
   * Start the automatic trace generation at fixed intervals
   */
  startTraceGeneration() {
    if (this.intervalId) {
      return; // Already running
    }

    this.intervalId = setInterval(() => {
      this.generateRandomTrace();
    }, this.TRACE_INTERVAL_MS);

    log.info(`Auto Tracer started - Generating traces every ${this.TRACE_INTERVAL_MS / 1000} seconds`);
  }

  /**
   * Stop the automatic trace generation
   */
  stopTraceGeneration() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info('Auto Tracer stopped');
    }
  }

  /**
   * Generate a random trace with weighted distribution of type
   */
  generateRandomTrace() {
    const traceType = this.getWeightedRandomValue(this.TRACE_TYPE_WEIGHTS);
    const { operation, message, customTag } = this.generateTraceData(traceType);
    
    // Generate the trace via trace service
    this.traceService.generateTrace(message, customTag, operation);
  }

  /**
   * Get a random value from an object with weighted probabilities
   */
  private getWeightedRandomValue<T extends string>(weights: Record<T, number>): T {
    const keys = Object.keys(weights) as T[];
    const totalWeight = keys.reduce((sum, key) => sum + weights[key], 0);
    
    let random = Math.random() * totalWeight;
    let weightSum = 0;
    
    for (const key of keys) {
      weightSum += weights[key];
      if (random <= weightSum) {
        return key;
      }
    }
    
    return keys[0]; // Fallback
  }

  /**
   * Generate trace data based on the trace type
   */
  private generateTraceData(traceType: TraceType): { operation: string, message: string, customTag: string } {
    const timestamp = new Date().toLocaleTimeString();
    
    switch (traceType) {
      case TraceType.API_REQUEST:
        const apiMethod = this.getRandomElement(['GET', 'POST', 'PUT', 'DELETE']);
        const endpoint = this.getRandomElement(['/api/users', '/api/products', '/api/orders', '/api/auth']);
        return {
          operation: `${apiMethod.toLowerCase()}_${endpoint.replace(/\//g, '_')}`,
          message: `API Request: ${apiMethod} ${endpoint} at ${timestamp}`,
          customTag: `method=${apiMethod},endpoint=${endpoint},auto=true`
        };
        
      case TraceType.DATABASE_QUERY:
        const dbOperation = this.getRandomElement(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
        const table = this.getRandomElement(['users', 'products', 'orders', 'payments']);
        return {
          operation: `db_${dbOperation.toLowerCase()}_${table}`,
          message: `Database Query: ${dbOperation} on ${table} table at ${timestamp}`,
          customTag: `operation=${dbOperation},table=${table},auto=true`
        };
        
      case TraceType.USER_ACTION:
        const userAction = this.getRandomElement(['login', 'logout', 'profile_update', 'password_change']);
        const userId = `user_${Math.floor(Math.random() * 1000)}`;
        return {
          operation: `user_action_${userAction}`,
          message: `User action: ${userAction} for ${userId} at ${timestamp}`,
          customTag: `action=${userAction},userId=${userId},auto=true`
        };
        
      case TraceType.BACKGROUND_JOB:
        const job = this.getRandomElement(['email_sending', 'data_processing', 'cleanup', 'report_generation']);
        return {
          operation: `job_${job}`,
          message: `Background job: ${job} started at ${timestamp}`,
          customTag: `job=${job},scheduled=true,auto=true`
        };
        
      case TraceType.MICROSERVICE_CALL:
        const service = this.getRandomElement(['auth-service', 'payment-service', 'notification-service', 'user-service']);
        const serviceMethod = this.getRandomElement(['getUser', 'processPayment', 'sendNotification', 'validateToken']);
        return {
          operation: `${service.replace('-', '_')}_${serviceMethod}`,
          message: `Microservice call: ${service}.${serviceMethod} at ${timestamp}`,
          customTag: `service=${service},method=${serviceMethod},auto=true`
        };
        
      case TraceType.EXTERNAL_API:
        const api = this.getRandomElement(['stripe', 'twilio', 'mailchimp', 'aws-s3']);
        const apiAction = this.getRandomElement(['getData', 'sendData', 'authenticate', 'validate']);
        return {
          operation: `external_${api}_${apiAction}`,
          message: `External API call: ${api} ${apiAction} at ${timestamp}`,
          customTag: `api=${api},action=${apiAction},external=true,auto=true`
        };
        
      default:
        return {
          operation: 'generic_trace',
          message: `Auto-generated trace at ${timestamp}`,
          customTag: 'auto=true'
        };
    }
  }

  /**
   * Get a random element from an array, optionally with weights
   */
  private getRandomElement<T>(items: T[], weights?: number[]): T {
    if (!weights) {
      return items[Math.floor(Math.random() * items.length)];
    }
    
    // Normalize weights if provided
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const normalizedWeights = weights.map(w => w / totalWeight);
    
    const random = Math.random();
    let weightSum = 0;
    
    for (let i = 0; i < items.length; i++) {
      weightSum += normalizedWeights[i];
      if (random <= weightSum) {
        return items[i];
      }
    }
    
    return items[0]; // Fallback
  }
} 