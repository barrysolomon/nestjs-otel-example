import pino from 'pino';
import * as winston from 'winston';

// Flags to toggle loggers
export const useWinston = true;  // Set to false to disable Winston
export const usePino = true;     // Set to false to disable Pino

// Declare loggers
export let pinoLogger: pino.Logger | null = null;
export let winstonLogger: winston.Logger | null = null;

/**
 * Mock function to retrieve user context.
 * Replace this with actual logic (e.g., fetching from an auth service or database).
 */
async function getCurrentUser() {
  return {
    id: process.env.DEFAULT_USER_ID || 'system',
    role: process.env.DEFAULT_USER_ROLE || 'admin',
  };
}

/**
 * Initializes loggers and sets user context.
 */
export const initializeLoggers = async () => {
  if (usePino) {
    pinoLogger = pino({
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    });
  }

  if (useWinston) {
    winstonLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [WINSTON] [${level}]: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'combined.log' }),
      ],
    });
  }

  // Set user context in loggers AFTER they are initialized
  await setUserContext();
};

/**
 * Sets the global user context in the logger.
 */
async function setUserContext() {
  const user = await getCurrentUser();

  if (usePino && pinoLogger) {
    pinoLogger = pinoLogger.child({ user });
  }
  if (useWinston && winstonLogger) {
    winstonLogger = winstonLogger.child({ user });
  }
}

/**
 * Unified logging function that logs to both Winston and Pino.
 */
export const log = {
  info: (message: string) => {
    if (usePino && pinoLogger) pinoLogger.info(message);
    if (useWinston && winstonLogger) winstonLogger.info(message);
  },
  error: (message: string) => {
    if (usePino && pinoLogger) pinoLogger.error(message);
    if (useWinston && winstonLogger) winstonLogger.error(message);
  },
  warn: (message: string) => {
    if (usePino && pinoLogger) pinoLogger.warn(message);
    if (useWinston && winstonLogger) winstonLogger.warn(message);
  },
  debug: (message: string) => {
    if (usePino && pinoLogger) pinoLogger.debug?.(message);
    if (useWinston && winstonLogger) winstonLogger.debug?.(message);
  },
};
