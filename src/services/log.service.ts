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
  private readonly MAX_HISTORY_SIZE = 1000; // Maximum number of logs to keep in memory
  private readonly MAX_AGE_DAYS = 7; // Maximum age for stored logs (7 days)
  
  // Running tallies for statistics
  private totalLogCount = 0;
  private totalLogsPerLevel: Record<string, number> = { debug: 0, info: 0, warn: 0, error: 0 };
  private totalLogsPerContext: Record<string, number> = {};
  private totalLogsPerDay: Record<string, number> = {};
  private statsLastReset = new Date().toISOString();

  constructor() {
    // Try to load logs from the file if it exists
    console.log(`LogService initialized with storage path: ${this.LOG_FILE_PATH}`);
    this.loadLogsFromFile();
    this.loadStatsFromFile();
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
        
        // Perform date-based pruning after loading
        this.pruneOldLogs();
      } else {
        console.log('No logs storage file found, starting with empty log history');
      }
    } catch (error) {
      console.error('Error loading logs from file:', error);
    }
  }

  /**
   * Load statistics from file
   */
  private loadStatsFromFile() {
    try {
      const statsFilePath = this.LOG_FILE_PATH.replace('.json', '-stats.json');
      if (fs.existsSync(statsFilePath)) {
        const fileData = fs.readFileSync(statsFilePath, 'utf8');
        const stats = JSON.parse(fileData);
        this.totalLogCount = stats.totalLogCount || 0;
        this.totalLogsPerLevel = stats.totalLogsPerLevel || { debug: 0, info: 0, warn: 0, error: 0 };
        this.totalLogsPerContext = stats.totalLogsPerContext || {};
        this.totalLogsPerDay = stats.totalLogsPerDay || {};
        this.statsLastReset = stats.statsLastReset || new Date().toISOString();
        console.log(`Loaded log statistics: ${this.totalLogCount} total logs`);
      }
    } catch (error) {
      console.error('Error loading log statistics:', error);
    }
  }

  /**
   * Save logs to file
   */
  private saveLogsToFile() {
    try {
      fs.writeFileSync(this.LOG_FILE_PATH, JSON.stringify(this.logHistory), 'utf8');
      
      // Save statistics to a separate file
      const statsFilePath = this.LOG_FILE_PATH.replace('.json', '-stats.json');
      const stats = {
        totalLogCount: this.totalLogCount,
        totalLogsPerLevel: this.totalLogsPerLevel,
        totalLogsPerContext: this.totalLogsPerContext,
        totalLogsPerDay: this.totalLogsPerDay,
        statsLastReset: this.statsLastReset
      };
      fs.writeFileSync(statsFilePath, JSON.stringify(stats), 'utf8');
    } catch (error) {
      console.error('Error saving logs to file:', error);
    }
  }

  /**
   * Remove logs older than MAX_AGE_DAYS
   */
  private pruneOldLogs() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.MAX_AGE_DAYS);
    
    const originalLength = this.logHistory.length;
    this.logHistory = this.logHistory.filter(log => {
      try {
        const logDate = new Date(log.timestamp);
        return logDate >= cutoffDate;
      } catch (e) {
        return true; // Keep logs with invalid dates
      }
    });
    
    const prunedCount = originalLength - this.logHistory.length;
    if (prunedCount > 0) {
      console.log(`Pruned ${prunedCount} logs older than ${this.MAX_AGE_DAYS} days`);
      this.saveLogsToFile();
    }
  }

  /**
   * Update the running statistics
   */
  private updateStatistics(logData: any) {
    // Increment total count
    this.totalLogCount++;
    
    // Increment level count
    if (logData.level) {
      this.totalLogsPerLevel[logData.level] = 
        (this.totalLogsPerLevel[logData.level] || 0) + 1;
    }
    
    // Increment context count
    if (logData.context) {
      this.totalLogsPerContext[logData.context] = 
        (this.totalLogsPerContext[logData.context] || 0) + 1;
    }
    
    // Increment daily count
    const day = logData.timestamp.split('T')[0]; // YYYY-MM-DD
    this.totalLogsPerDay[day] = (this.totalLogsPerDay[day] || 0) + 1;
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
    
    // Update statistics
    this.updateStatistics(logData);
    
    // Add to history using queue approach (oldest logs at the end)
    this.logHistory.unshift(logData);
    
    // Apply size limit to history
    if (this.logHistory.length > this.MAX_HISTORY_SIZE) {
      this.logHistory.pop(); // Remove oldest log (from the end)
    }
    
    // Periodically run date-based pruning (every 100 logs)
    if (this.totalLogCount % 100 === 0) {
      this.pruneOldLogs();
    }
    
    // Save to file periodically (every 10 logs)
    if (this.totalLogCount % 10 === 0) {
      this.saveLogsToFile();
    }
    
    // Debug log count
    if (this.totalLogCount % 100 === 0) {
      console.log(`Log history: ${this.logHistory.length} stored, ${this.totalLogCount} total`);
    }
    
    return logData;
  }

  /**
   * Get log history
   */
  getLogHistory() {
    return this.logHistory;
  }
  
  /**
   * Get log statistics
   */
  getLogStatistics() {
    return {
      totalLogs: this.totalLogCount,
      storedLogs: this.logHistory.length,
      logsPerLevel: this.totalLogsPerLevel,
      logsPerContext: this.totalLogsPerContext,
      logsPerDay: this.totalLogsPerDay,
      statsLastReset: this.statsLastReset
    };
  }

  /**
   * Reset log statistics
   */
  resetLogStatistics() {
    this.totalLogCount = this.logHistory.length;
    this.totalLogsPerLevel = { debug: 0, info: 0, warn: 0, error: 0 };
    this.totalLogsPerContext = {};
    this.totalLogsPerDay = {};
    this.statsLastReset = new Date().toISOString();
    
    // Rebuild statistics from current logs
    this.logHistory.forEach(log => {
      if (log.level) {
        this.totalLogsPerLevel[log.level] = 
          (this.totalLogsPerLevel[log.level] || 0) + 1;
      }
      
      if (log.context) {
        this.totalLogsPerContext[log.context] = 
          (this.totalLogsPerContext[log.context] || 0) + 1;
      }
      
      if (log.timestamp) {
        const day = log.timestamp.split('T')[0]; // YYYY-MM-DD
        this.totalLogsPerDay[day] = (this.totalLogsPerDay[day] || 0) + 1;
      }
    });
    
    this.saveLogsToFile();
    return this.getLogStatistics();
  }
} 