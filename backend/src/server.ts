import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';

const server = app.listen(env.PORT, () => {
  logger.info(
    `🚀 Server running in [${env.NODE_ENV}] mode on port ${env.PORT} with prefix [${env.API_PREFIX}]`
  );
  logger.info(`🏥 Health endpoint: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
});

const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed. Process terminating.');
    process.exit(0);
  });

  // Force exit if not closed within 10s
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason: Error | unknown) => {
  logger.error({ err: reason }, 'Unhandled Rejection detected');
});

process.on('uncaughtException', (error: Error) => {
  logger.error({ err: error }, 'Uncaught Exception detected');
  process.exit(1);
});
