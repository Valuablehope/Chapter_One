const fs = require('fs');
const path = require('path');
const db = require('./db');
const logger = require('../config/logger');

async function ensureMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      app_version VARCHAR(50)
    );
  `;
  await db.query(query);
}

async function getExecutedMigrations() {
  const result = await db.query('SELECT filename FROM schema_migrations ORDER BY id ASC');
  return result.rows.map(row => row.filename);
}

async function runPendingMigrations() {
  logger.info('Starting migration sequence...');
  await ensureMigrationsTable();

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    logger.warn('No migrations directory found, skipping migrations.');
    return;
  }

  const allFiles = fs.readdirSync(migrationsDir)
                     .filter(f => f.endsWith('.sql'))
                     .sort(); // Sort by timestamp prefix
                     
  const executedFiles = await getExecutedMigrations();
  const pendingFiles = allFiles.filter(f => !executedFiles.includes(f));

  if (pendingFiles.length === 0) {
    logger.info('Database is up to date. No pending migrations.');
    return;
  }

  // Execute each pending migration in a transaction
  logger.info(`Found ${pendingFiles.length} pending migrations.`);
  const appVersion = require('../../package.json').version;

  for (const filename of pendingFiles) {
    const client = await db.getClient();
    try {
      logger.info(`Running migration: ${filename}`);
      const filePath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Begin explicit transaction
      await client.query('BEGIN');
      await client.query(sql);
      
      const insertQuery = `
        INSERT INTO schema_migrations (filename, app_version) 
        VALUES ($1, $2)
      `;
      await client.query(insertQuery, [filename, appVersion]);

      await client.query('COMMIT');
      logger.info(`Successfully completed migration: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to execute migration ${filename}`, { error: error.message, stack: error.stack });
      throw new Error(`Migration ${filename} failed: ${error.message}`);
    } finally {
      client.release();
    }
  }
}

module.exports = {
  runPendingMigrations
};
