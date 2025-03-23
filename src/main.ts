import { initializeOpenTelemetry } from './otel-config';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { useWinston, usePino, initializeLoggers, log } from './logger.config';
import * as fs from 'fs';
import { join } from 'path';
import * as express from 'express';

// Initialize NestJS instrumentation BEFORE other imports
const nestInstrumentation = new NestInstrumentation();
nestInstrumentation.enable();

/**
 * Function to detect runtime environment (ECS, Kubernetes, etc.).
 */
function detectRuntimeEnvironment(): string {
  if (process.env.ECS_CONTAINER_METADATA_URI || process.env.ECS_CONTAINER_METADATA_URI_V4) {
    return 'ECS';
  }
  if (fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount/token')) {
    return 'Kubernetes';
  }
  return 'Unknown';
}

async function bootstrap() {
  // Set up OpenTelemetry before importing any instrumented modules
  process.env.OTEL_SERVICE_NAME = 'nestjs-opentelemetry-example';
  await initializeOpenTelemetry(
    'nestjs-opentelemetry-example',
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || '',
    process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || '',
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || ''
  );

  // Initialize loggers after Lumigo is set up
  await initializeLoggers();

  // Log application startup
  log.info('NestJS application is running');

  // Log environment variables with user context
  const envVars = JSON.stringify(process.env, null, 2);
  log.info(`Environment Variables on Startup: ${envVars}`);

  // Detect runtime environment and log it
  const runtimeEnv = detectRuntimeEnvironment();
  log.info(`Running in ${runtimeEnv} environment`);
  log.info(`OTLP Exporter Endpoint: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'Not Set'}`);

  // Create the NestJS application
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Serve static files from the public directory at the root path
  app.use(express.static(join(__dirname, '..', 'src/public')));
  
  // Also serve them at the /public path for backward compatibility
  app.use('/public', express.static(join(__dirname, '..', 'src/public')));

  // Start listening
  await app.listen(3000);
}

bootstrap();
