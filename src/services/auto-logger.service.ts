import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { LogService } from './log.service';
import { log } from '../logger.config';

/**
 * Types of log data to generate
 */
enum LogType {
  USER_ACTIVITY = 'user_activity',
  SYSTEM_METRICS = 'system_metrics',
  API_REQUEST = 'api_request',
  DATABASE_OPERATION = 'database_operation',
  PAYMENT_PROCESSING = 'payment_processing',
  PLAIN_TEXT = 'plain_text'
}

/**
 * Severity levels for logs
 */
enum LogSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Service that automatically generates random logs with different severity levels and data structures
 */
@Injectable()
export class AutoLoggerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private intervalId: NodeJS.Timeout | null = null;
  private logIntervalMs = 2000; // Default: Generate logs every 2 seconds
  private readonly MIN_INTERVAL_MS = 10; // Minimum allowed interval is 10ms
  
  // Weights for random distribution - higher numbers mean more frequent occurrence
  private readonly SEVERITY_WEIGHTS = {
    [LogSeverity.DEBUG]: 4,
    [LogSeverity.INFO]: 10,
    [LogSeverity.WARN]: 3,
    [LogSeverity.ERROR]: 1
  };

  private readonly LOG_TYPE_WEIGHTS = {
    [LogType.USER_ACTIVITY]: 8,
    [LogType.SYSTEM_METRICS]: 6,
    [LogType.API_REQUEST]: 10,
    [LogType.DATABASE_OPERATION]: 7,
    [LogType.PAYMENT_PROCESSING]: 4,
    [LogType.PLAIN_TEXT]: 3
  };

  constructor(private readonly logService: LogService) {}

  /**
   * Start generating logs when the application starts
   */
  onApplicationBootstrap() {
    log.info('Auto Logger Service starting');
    this.startLogGeneration();
  }

  /**
   * Stop generating logs when the application shuts down
   */
  onApplicationShutdown() {
    this.stopLogGeneration();
    log.info('Auto Logger Service stopped');
  }

  /**
   * Check if the auto-logger is currently running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Get the current interval in milliseconds
   */
  getInterval(): number {
    return this.logIntervalMs;
  }

  /**
   * Set the interval for log generation (minimum 10ms)
   * @param intervalMs interval in milliseconds
   */
  setInterval(intervalMs: number): void {
    // Ensure interval is not less than minimum allowed
    this.logIntervalMs = Math.max(this.MIN_INTERVAL_MS, intervalMs);
    
    // If already running, restart with new interval
    if (this.isRunning()) {
      this.stopLogGeneration();
      this.startLogGeneration();
    }
    
    log.info(`Auto Logger interval set to ${this.logIntervalMs}ms`);
  }

  /**
   * Start the automatic log generation at fixed intervals
   * @param intervalMs optional interval in milliseconds
   */
  startLogGeneration(intervalMs?: number): void {
    // Set new interval if provided
    if (intervalMs !== undefined) {
      this.setInterval(intervalMs);
    }
    
    // Stop if already running
    if (this.intervalId) {
      this.stopLogGeneration();
    }

    this.intervalId = setInterval(() => {
      this.generateRandomLog();
    }, this.logIntervalMs);

    log.info(`Auto Logger started - Generating logs every ${this.logIntervalMs / 1000} seconds`);
  }

  /**
   * Stop the automatic log generation
   */
  stopLogGeneration() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Generate a random log with weighted distribution of severity and type
   */
  generateRandomLog() {
    const severity = this.getWeightedRandomValue(this.SEVERITY_WEIGHTS);
    const logType = this.getWeightedRandomValue(this.LOG_TYPE_WEIGHTS);
    
    // For plain text logs, skip structured data completely
    if (logType === LogType.PLAIN_TEXT) {
      const plainMessages = [
        "Application is running smoothly",
        "Cache invalidation completed successfully",
        "Background job scheduler initialized",
        "Memory usage within acceptable limits",
        "User session expired due to inactivity",
        "Database connection pool stats: 5 active, 15 idle",
        "Webhook delivery attempt failed, will retry in 60 seconds",
        "Failed to connect to third-party API, timeout after 5000ms"
      ];
      
      const message = plainMessages[Math.floor(Math.random() * plainMessages.length)];
      this.logService.logMessage(message, severity);
      return;
    }
    
    // Generate structured log data based on type
    const logData = this.generateLogData(logType);
    
    // Add common fields to all structured logs
    const structuredLog = {
      timestamp: new Date().toISOString(),
      type: logType,
      ...logData
    };
    
    this.logService.logMessage(structuredLog, severity);
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
   * Generate random log data based on the log type
   */
  private generateLogData(logType: LogType): Record<string, any> {
    switch (logType) {
      case LogType.USER_ACTIVITY:
        return {
          user_id: `user_${Math.floor(Math.random() * 1000)}`,
          session_id: `sess_${this.generateRandomString(12)}`,
          action: this.getRandomElement(['login', 'logout', 'view_page', 'update_profile', 'delete_account']),
          ip_address: `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
          user_agent: this.getRandomElement([
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
          ])
        };
        
      case LogType.SYSTEM_METRICS:
        return {
          host: `server-${Math.floor(Math.random() * 10)}`,
          metrics: {
            cpu_usage: Math.random().toFixed(2),
            memory_usage: Math.floor(Math.random() * 8 * 1024) + 'MB',
            disk_space: {
              total: '500GB',
              used: `${Math.floor(Math.random() * 500)}GB`,
              free: `${Math.floor(Math.random() * 300)}GB`
            },
            network: {
              rx_bytes: Math.floor(Math.random() * 1000000),
              tx_bytes: Math.floor(Math.random() * 1000000)
            }
          },
          uptime: `${Math.floor(Math.random() * 30)}d ${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`
        };
        
      case LogType.API_REQUEST:
        return {
          request_id: `req_${this.generateRandomString(16)}`,
          method: this.getRandomElement(['GET', 'POST', 'PUT', 'DELETE']),
          endpoint: this.getRandomElement(['/api/users', '/api/products', '/api/orders', '/api/auth']),
          status_code: this.getRandomElement([200, 201, 400, 401, 403, 404, 500], [70, 10, 5, 5, 3, 5, 2]),
          duration_ms: Math.floor(Math.random() * 1000),
          client_ip: `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
          headers: {
            'user-agent': 'Mozilla/5.0',
            'content-type': 'application/json',
            'x-request-id': this.generateRandomString(8)
          }
        };
        
      case LogType.DATABASE_OPERATION:
        return {
          operation: this.getRandomElement(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
          table: this.getRandomElement(['users', 'products', 'orders', 'payments', 'sessions']),
          duration_ms: Math.floor(Math.random() * 200),
          rows_affected: Math.floor(Math.random() * 100),
          query_id: `query_${this.generateRandomString(10)}`,
          connection_id: Math.floor(Math.random() * 100),
          database: this.getRandomElement(['main', 'analytics', 'archive'])
        };
        
      case LogType.PAYMENT_PROCESSING:
        return {
          payment_id: `pmt_${this.generateRandomString(16)}`,
          customer_id: `cust_${Math.floor(Math.random() * 10000)}`,
          amount: +(Math.random() * 1000).toFixed(2),
          currency: this.getRandomElement(['USD', 'EUR', 'GBP', 'JPY']),
          status: this.getRandomElement(['pending', 'completed', 'failed', 'refunded']),
          provider: this.getRandomElement(['stripe', 'paypal', 'adyen', 'braintree']),
          payment_method: this.getRandomElement(['credit_card', 'bank_transfer', 'digital_wallet']),
          error: Math.random() < 0.2 ? {
            code: this.getRandomElement(['insufficient_funds', 'card_declined', 'expired_card']),
            message: 'Payment could not be processed'
          } : null
        };
        
      default:
        return {
          message: `Unspecified log type: ${logType}`,
          random_value: Math.random()
        };
    }
  }

  /**
   * Generate a random string of specified length
   */
  private generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Get a random element from an array with optional weights
   */
  private getRandomElement<T>(items: T[], weights?: number[]): T {
    if (!weights) {
      return items[Math.floor(Math.random() * items.length)];
    }
    
    // If weights are provided, use weighted random selection
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }
    
    return items[0]; // Fallback
  }
} 