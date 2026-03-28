const logger = require('../config/logger');
const db = require('../updater/db');
const migrationRunner = require('../updater/migrationRunner');
const backendServer = require('../backend/server');

async function init() {
  logger.info('--- Starting Application Bootstrap ---');

  // 1. Load environment config
  require('dotenv').config();
  logger.info('Environment config loaded.');

  // 2. Initialize DB Connection
  try {
    await db.connect();
    logger.info('Database connection established.');
  } catch (error) {
    logger.error('Failed to connect to database', { error: error.message });
    throw new Error(`Database Connection Error: ${error.message}`);
  }

  // 3. Run DB Migrations
  try {
    logger.info('Running database migrations...');
    await migrationRunner.runPendingMigrations();
    logger.info('Database migrations completed successfully.');
  } catch (error) {
    logger.error('Migration failed, aborting startup', { error: error.message });
    throw new Error(`Migration Failure: ${error.message}`);
  }

  // 4. Start Backend Services
  try {
    logger.info('Starting bundled Node.js backend...');
    await backendServer.start();
    logger.info('Backend services running.');
  } catch (error) {
    logger.error('Failed to start backend', { error: error.message });
    throw new Error(`Backend Startup Error: ${error.message}`);
  }

  logger.info('--- Bootstrap Flow Completed Successfully ---');
}

async function shutdown() {
  logger.info('Shutting down backend services...');
  await backendServer.stop();
  logger.info('Closing database connection...');
  await db.disconnect();
}

module.exports = {
  init,
  shutdown
};
