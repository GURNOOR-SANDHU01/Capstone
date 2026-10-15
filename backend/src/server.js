const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');

const server = app.listen(config.port, () => {
  logger.info(`=======================================================`);
  logger.info(`✨ Sentience Backend API Server is running`);
  logger.info(`🌍 Environment: ${config.env}`);
  logger.info(`🚀 Listening on port: ${config.port}`);
  logger.info(`🔥 Firebase Project: ${config.firebase.projectId}`);
  logger.info(`📍 Database Location: ${config.firebase.databaseLocation}`);
  logger.info(`🤖 AI Model Adapter: ${config.modelApi.useMock ? 'Mock Model Adapter (Development)' : config.modelApi.baseUrl}`);
  logger.info(`💻 Frontend UI: http://localhost:${config.port}`);
  logger.info(`🩺 Health Check: http://localhost:${config.port}/api/health`);
  logger.info(`=======================================================`);
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Gracefully shutting down HTTP server...`);
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at Promise', { reason: reason?.message || reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception thrown', { error: err.message, stack: err.stack });
  process.exit(1);
});
