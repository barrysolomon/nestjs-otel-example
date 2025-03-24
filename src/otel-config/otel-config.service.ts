import { Injectable, Logger } from '@nestjs/common';
import { getSDK, reinitializeOpenTelemetry, initializeOpenTelemetry, startSdk } from '../otel-config';

// Define the collector configuration interface
interface CollectorConfig {
  tracesEndpoint: string;
  logsEndpoint: string;
  metricsEndpoint: string;
}

@Injectable()
export class OtelConfigService {
  private logger = new Logger(OtelConfigService.name);
  private config = {
    collectorType: 'otel', // Default collector
    testMode: process.env.NODE_ENV !== 'production', // Don't actually reconnect in test/dev mode
    collectors: {
      otel: {
        tracesEndpoint: 'http://otel-collector.observability.svc.cluster.local:4318',
        logsEndpoint: 'http://otel-collector.observability.svc.cluster.local:4318',
        metricsEndpoint: 'http://otel-collector.observability.svc.cluster.local:4317',
      },
      lumigo: {
        tracesEndpoint: 'http://otel-collector.observability.svc.cluster.local:4318',
        logsEndpoint: 'http://otel-collector.observability.svc.cluster.local:4318',
        metricsEndpoint: 'http://otel-collector.observability.svc.cluster.local:4318',
      },
      sawmills: {
        tracesEndpoint: 'http://sawmills-collector.sawmills.svc.cluster.local:4318',
        logsEndpoint: 'http://sawmills-collector.sawmills.svc.cluster.local:4318',
        metricsEndpoint: 'http://sawmills-collector.sawmills.svc.cluster.local:4317',
      },
      custom: {
        tracesEndpoint: '',
        logsEndpoint: '',
        metricsEndpoint: '',
      }
    }
  };

  private sdk: any;
  private provider: any = null;
  private isInitialized = false;
  private telemetryConfig = {
    useLocal: true,
    useLumigo: false,
    useSawmills: false,
    customEndpoint: null
  };

  constructor() {
    // Check if OpenTelemetry is enabled
    if (process.env.ENABLE_OTEL === 'true') {
      this.initializeTelemetry();
    } else {
      this.logger.log('OpenTelemetry is disabled. Set ENABLE_OTEL=true to enable telemetry.');
    }
  }

  private async initializeTelemetry() {
    try {
      // Get the selected collector
      const selectedCollector = this.config.collectors[this.config.collectorType];
      
      // If OTEL_EXPORTER_OTLP_HEADERS is defined, use it for all endpoints
      if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
        this.logger.log('Using OTEL_EXPORTER_OTLP_HEADERS for all endpoints');
        // The headers will be automatically used by the OpenTelemetry SDK
        // No need to modify the endpoints here
      }

      // Initialize and start the SDK
      this.sdk = await initializeOpenTelemetry(
        'nestjs-opentelemetry-example',
        selectedCollector.tracesEndpoint,
        selectedCollector.logsEndpoint,
        selectedCollector.metricsEndpoint
      );
      
      this.isInitialized = true;
      this.logger.log('OpenTelemetry initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenTelemetry:', error);
      throw error;
    }
  }

  getConfig() {
    return this.config;
  }

  async updateConfig(body: any) {
    try {
      // Validate collectorType is provided and is a valid option
      if (!body.collectorType || !this.config.collectors[body.collectorType]) {
        throw new Error('Invalid collector type');
      }

      // Update collector type
      this.config.collectorType = body.collectorType;

      // Update test mode if provided
      if (body.testMode !== undefined) {
        this.config.testMode = body.testMode;
      }

      // Get the selected collector
      const selectedCollector = this.config.collectors[this.config.collectorType];

      // Only restart SDK if not in test mode and OpenTelemetry is enabled
      if (!this.config.testMode && process.env.ENABLE_OTEL === 'true') {
        try {
          await this.resetOtelSdk(selectedCollector, this.config.testMode);
        } catch (sdkError) {
          console.error('Error restarting OpenTelemetry SDK:', sdkError);
          return {
            ...this.config,
            error: sdkError.message
          };
        }
      } else {
        console.log('Test mode enabled or OpenTelemetry disabled, skipping OpenTelemetry SDK restart');
      }

      return this.config;
    } catch (error) {
      console.error('Error updating config:', error);
      throw error;
    }
  }

  private resetOtelSdk(selectedCollector: CollectorConfig, testMode: boolean): Promise<void> {
    // If in test mode or OpenTelemetry is disabled, don't actually restart the SDK
    if (testMode || process.env.ENABLE_OTEL !== 'true') {
      console.log('Test mode enabled or OpenTelemetry disabled: Not restarting OpenTelemetry SDK');
      return Promise.resolve();
    }

    return new Promise(async (resolve, reject) => {
      try {
        // Stop the current SDK if it exists
        if (this.sdk) {
          try {
            await this.sdk.shutdown();
          } catch (err) {
            console.warn('Error shutting down previous SDK instance:', err);
          }
        }

        // Set environment variables for OpenTelemetry exporters
        process.env.OTEL_SERVICE_NAME = 'nestjs-opentelemetry-example';
        process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'grpc';
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = selectedCollector.tracesEndpoint;
        process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = selectedCollector.logsEndpoint;
        process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = selectedCollector.metricsEndpoint;

        // Initialize the new SDK with timeout
        const timeoutId = setTimeout(() => {
          reject(new Error('Timeout starting OpenTelemetry SDK - collector may be unreachable'));
        }, 5000);

        try {
          // Initialize and start the SDK
          this.sdk = await initializeOpenTelemetry(
            'nestjs-opentelemetry-example',
            selectedCollector.tracesEndpoint,
            selectedCollector.logsEndpoint,
            selectedCollector.metricsEndpoint
          );
          
          clearTimeout(timeoutId);
          console.log('OpenTelemetry SDK restarted successfully');
          resolve();
        } catch (error) {
          clearTimeout(timeoutId);
          console.error('Error starting OpenTelemetry SDK:', error);
          reject(error);
        }
      } catch (error) {
        console.error('Error initializing OpenTelemetry SDK:', error);
        reject(error);
      }
    });
  }

  /**
   * Update telemetry exporters configuration dynamically
   * @param config Configuration for telemetry exporters
   */
  async updateExporters(config: {
    useLocal: boolean;
    useLumigo: boolean;
    useSawmills: boolean;
    customEndpoint: any | null;
  }): Promise<boolean> {
    this.logger.log(`Updating OpenTelemetry exporters: ${JSON.stringify(config)}`);
    this.telemetryConfig = config;

    try {
      // Only proceed if OpenTelemetry is enabled
      if (process.env.ENABLE_OTEL !== 'true') {
        this.logger.log('OpenTelemetry is disabled. Skipping exporter update.');
        return false;
      }

      // Save configuration to env variables for the collector to access
      if (config.customEndpoint && config.customEndpoint.url) {
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT = config.customEndpoint.url;
        if (config.customEndpoint.header) {
          process.env.OTEL_EXPORTER_OTLP_HEADERS = config.customEndpoint.header;
        }
      }
      
      this.logger.log('Telemetry exporter configuration updated. Will apply on next restart.');
      return true;
    } catch (error) {
      this.logger.error(`Failed to update telemetry exporters: ${error.message}`, error.stack);
      return false;
    }
  }
} 