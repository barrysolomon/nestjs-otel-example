import pino from 'pino';
import * as winston from 'winston';

// Flags to toggle loggers
export const useWinston = true;  // Set to false to disable Winston
export const usePino = true;     // Set to false to disable Pino

// Declare loggers to be initialized later
export let pinoLogger = null;
export let winstonLogger = null;

// Function to initialize loggers after Lumigo setup
export const initializeLoggers = () => {
  if (usePino) {
    pinoLogger = pino({
      level: 'info',
      transport: {
        target: 'pino-pretty', // Pretty print output for better readability
        options: {
          colorize: true, // Colorize output for better readability
        },
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
        new winston.transports.Console(), // Correctly access the Console transport
        new winston.transports.File({ filename: 'combined.log' }), // Correctly access the File transport
      ],
    });
  }
};
