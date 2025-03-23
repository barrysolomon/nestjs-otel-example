import { Injectable } from '@nestjs/common';
import { log } from '../logger.config';
import { logs } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { getLoggerProvider } from '../otel-config';

@Injectable()
export class LogService {
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
      let logData: any = {};
      let logMessageStr: string;
      
      // Handle different message types
      if (typeof message === 'string') {
        try {
          // Try to parse as JSON
          logData = JSON.parse(message);
          logMessageStr = `Custom log message: ${message}`;
        } catch (parseError) {
          // Plain text message
          logMessageStr = message;
          logData = { message: logMessageStr };
        }
      } else {
        // Object message
        logData = message;
        logMessageStr = `Custom log message: ${JSON.stringify(logData)}`;
      }
      
      // Log using local logger
      switch (severity) {
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
      
      return true;
    } catch (error) {
      log.error(`Error processing log: ${error.message}`);
      return false;
    }
  }
} 