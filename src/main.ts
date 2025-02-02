import { initializeOpenTelemetry } from './otel-config'; // ✅ Import OTEL initialization

import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { useWinston, usePino, initializeLoggers, winstonLogger, pinoLogger } from './logger.config';
import * as fs from 'fs';

function detectRuntimeEnvironment(): string {
  // Detect ECS (Amazon Elastic Container Service)
  if (process.env.ECS_CONTAINER_METADATA_URI || process.env.ECS_CONTAINER_METADATA_URI_V4) {
    return 'ECS';
  }

  // Detect Kubernetes (K8s)
  if (fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount/token')) {
    return 'Kubernetes';
  }

  return 'Unknown';
}

async function bootstrap() {

  // Initialize OpenTelemetry
  await initializeOpenTelemetry();
  
  // Initialize Lumigo
  if (process.env.LUMIGO_MANUAL_INIT === 'true') {
    const lumigo = await import('@lumigo/opentelemetry');
    await lumigo.init;
  }

  // Initialize loggers after Lumigo is set up
  await initializeLoggers();
  if (useWinston && winstonLogger) {
    winstonLogger.info('NestJS application is running (Winston)');
  }
  if (usePino && pinoLogger) {
    pinoLogger.info('NestJS application is running (Pino)');
  }

  // Initialize NestJS instrumentation
  const nestInstrumentation = new NestInstrumentation();
  nestInstrumentation.enable();

  // Log environment variables
  const envVars = JSON.stringify(process.env, null, 2);
  if (useWinston && winstonLogger) {
    winstonLogger.info('Environment Variables on Startup:', { envVars });
  }
  if (usePino && pinoLogger) {
    pinoLogger.info('Environment Variables on Startup:', { envVars });
  }

  // Detect runtime environment
  const runtimeEnv = detectRuntimeEnvironment();
  if (useWinston && winstonLogger) {
    winstonLogger.info(`Running in ${runtimeEnv} environment (Winston)`);
    winstonLogger.info(`OTLP Exporter Endpoint: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'Not Set'}`);
  }
  if (usePino && pinoLogger) {
    pinoLogger.info(`Running in ${runtimeEnv} environment (Pino)`);
    pinoLogger.info(`OTLP Exporter Endpoint: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'Not Set'}`);
  }

  // Create the NestJS application
  const app = await NestFactory.create(AppModule);

  // Start listening
  await app.listen(3000);

}

bootstrap();
