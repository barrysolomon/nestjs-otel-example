import { Injectable } from '@nestjs/common';
import { log } from '../logger.config';
import { logs } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { getLoggerProvider } from '../otel-config';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class LogService {
  private logHistory: any[] = [];
  private readonly LOG_FILE_PATH = process.env.LOG_STORAGE_PATH || join(process.cwd(), 'logs-storage.json');

  constructor() {
    // Try to load logs from the file if it exists
    console.log(`LogService initialized with storage path: ${this.LOG_FILE_PATH}`);
    this.loadLogsFromFile();
  }

  /**
   * Load logs from the file if it exists
   */
  private loadLogsFromFile() {
    try {
      if (fs.existsSync(this.LOG_FILE_PATH)) {
        const fileData = fs.readFileSync(this.LOG_FILE_PATH, 'utf8');
        this.logHistory = JSON.parse(fileData);
        console.log(`Loaded ${this.logHistory.length} logs from storage file`);
      } else {
        console.log('No logs storage file found, starting with empty log history');
      }
    } catch (error) {
      console.error('Error loading logs from file:', error);
    }
  }

  /**
   * Save logs to file
   */
  private saveLogsToFile() {
    try {
      fs.writeFileSync(this.LOG_FILE_PATH, JSON.stringify(this.logHistory.slice(0, 1000)), 'utf8');
    } catch (error) {
      console.error('Error saving logs to file:', error);
    }
  }

  /**
   * Default log message template with sample data
   */
  getDefaultLogMessage(): string {
    return JSON.stringify({
      "email": {
        "account_id": "acc_123456789",
        "address": "user@example.com"
      },
      "metrics": {
        "sent_count": 150,
        "delivery_rate": 0.98,
        "bounce_rate": 0.02
      }
    }, null, 2);
  }

  /**
   * Maps severity string to OpenTelemetry SeverityNumber
   */
  private getSeverityNumber(severity: string): SeverityNumber {
    switch (severity.toLowerCase()) {
      case 'debug':
        return SeverityNumber.DEBUG;
      case 'warn':
        return SeverityNumber.WARN;
      case 'error':
        return SeverityNumber.ERROR;
      default:
        return SeverityNumber.INFO;
    }
  }

  /**
   * Logs a message with the specified severity using both local logger and OpenTelemetry
   */
  logMessage(message: any, severity: string): boolean {
    try {
      console.log(`LogService.logMessage called with severity: ${severity}, message type: ${typeof message}`);
      
      let logData: any = {};
      let logMessageStr: string;
      let context: string = 'Application';
      
      // Handle different message types
      if (typeof message === 'string') {
        try {
          // Try to parse as JSON
          logData = JSON.parse(message);
          logMessageStr = `${message}`;
        } catch (parseError) {
          // Plain text message
          logMessageStr = message;
          logData = { message: logMessageStr };
        }
      } else if (typeof message === 'object') {
        // Object message
        logData = { ...message }; // Clone to avoid reference issues
        
        // Extract context if available
        if (logData.context) {
          context = logData.context;
        } else if (logData.type) {
          context = logData.type;
        }
        
        // Use message property if available, otherwise stringify the whole object
        if (logData.message) {
          logMessageStr = logData.message;
        } else {
          logMessageStr = `Log event: ${JSON.stringify(logData)}`;
        }
      } else {
        // Fallback for other types
        logMessageStr = String(message);
        logData = { message: logMessageStr };
      }
      
      // Log using local logger
      switch (severity.toLowerCase()) {
        case 'debug':
          log.debug(logMessageStr);
          break;
        case 'warn':
          log.warn(logMessageStr);
          break;
        case 'error':
          log.error(logMessageStr);
          break;
        default:
          log.info(logMessageStr);
      }
      
      // Log using OpenTelemetry
      try {
        const otelLogger = logs.getLogger('nestjs-logger');
        otelLogger.emit({
          severityNumber: this.getSeverityNumber(severity),
          severityText: severity.toUpperCase(),
          body: logMessageStr,
          attributes: typeof logData === 'object' ? logData : { message: logData },
        });
      } catch (otelError) {
        console.error('Error sending log to OpenTelemetry:', otelError);
      }
      
      // Store in log history
      const savedLog = this.storeLog(logMessageStr, severity, logData, context);
      console.log(`Log stored in history with ID: ${savedLog.id}`);
      
      return true;
    } catch (error) {
      console.error(`Error processing log in LogService: ${error.message}`, error);
      log.error(`Error processing log: ${error.message}`);
      return false;
    }
  }

  /**
   * Store log in history
   */
  private storeLog(message: string, level: string, metadata: any, context: string = 'Application') {
    const logData = {
      id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      level: level.toLowerCase(),
      message: message,
      context: context,
      metadata: metadata,
      service: 'nestjs-opentelemetry-example'
    };
    
    this.logHistory.unshift(logData);
    
    // Keep only the last 1000 logs
    if (this.logHistory.length > 1000) {
      this.logHistory = this.logHistory.slice(0, 1000);
    }
    
    // Save to file every 10 logs
    if (this.logHistory.length % 10 === 0) {
      this.saveLogsToFile();
    }
    
    // Debug log count
    if (this.logHistory.length % 10 === 0) {
      console.log(`Log history now contains ${this.logHistory.length} entries`);
    }
    
    return logData;
  }

  /**
   * Get log history
   */
  getLogHistory() {
    return this.logHistory;
  }
} 