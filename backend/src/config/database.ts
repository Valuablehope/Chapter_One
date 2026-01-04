import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { dbCircuitBreaker } from '../utils/circuitBreaker';

// Find root directory by looking for .env file
// Go up from backend/src/config/ (3 levels) or backend/dist/config/ (3 levels)
function findEnvFile(): string {
  // 1. Check current directory and parents
  let currentDir = __dirname;
  const maxDepth = 5;

  for (let i = 0; i < maxDepth; i++) {
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) return envPath;
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  // 2. Check production resources path (Electron)
  // In production, __dirname is .../resources/app.asar.unpacked/backend/dist
  const productionEnvPath = path.resolve(__dirname, '../../../../.env');
  if (fs.existsSync(productionEnvPath)) return productionEnvPath;

  // 3. Last resort fallback
  return path.resolve(__dirname, '../../../.env');
}

const envPath = findEnvFile();
dotenv.config({ path: envPath });

const isProduction = process.env.NODE_ENV === 'production';

// Debug: Log which .env file is being used (only in development)
if (!isProduction) {
  logger.info(`📄 Loading .env from: ${envPath}`);
  logger.debug(`📄 DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
}

// Support both DATABASE_URL and individual variables
let dbConfig: PoolConfig;

// Debug: Log which config method is being used (only in development)
if (process.env.DATABASE_URL) {
  if (!isProduction) {
    logger.info('📦 Using DATABASE_URL connection string');
  }
  // Use connection string if provided
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
} else {
  if (!isProduction) {
    logger.info('📦 Using individual database variables');
  }
  // Use individual variables
  const dbPassword = process.env.DB_PASSWORD !== undefined
    ? String(process.env.DB_PASSWORD)
    : '';

  if (!dbPassword && process.env.NODE_ENV !== 'test') {
    logger.warn('⚠️  DB_PASSWORD is not set in .env file');
    logger.warn('   Database connection will likely fail.');
    logger.warn('   Please set DB_PASSWORD or DATABASE_URL in your .env file');
  }

  dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'Chapter_One',
    user: process.env.DB_USER || 'postgres',
    password: dbPassword,
    max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

// Create connection pool
export const pool = new Pool(dbConfig);

// Track consecutive fatal errors for reconnection logic
let consecutiveFatalErrors = 0;
const MAX_FATAL_ERRORS = 5;

/**
 * Classify database errors as fatal or transient
 * Fatal errors: authentication failures, invalid configuration, unrecoverable states
 * Transient errors: connection timeouts, network issues, temporary unavailability
 */
function isFatalError(err: Error): boolean {
  const fatalPatterns = [
    'password authentication failed',
    'SASL authentication failed',
    'database ".*" does not exist',
    'role ".*" does not exist',
    'invalid connection string',
    'connection refused',
  ];

  const errorMessage = err.message.toLowerCase();
  return fatalPatterns.some(pattern => {
    const regex = new RegExp(pattern);
    return regex.test(errorMessage);
  });
}

// Handle pool errors with graceful degradation
pool.on('error', (err: Error) => {
  logger.error('Database pool error', { error: err.message, stack: err.stack });

  if (isFatalError(err)) {
    consecutiveFatalErrors++;
    logger.fatal('Fatal database error detected', {
      error: err.message,
      consecutiveErrors: consecutiveFatalErrors
    });

    // Only exit after multiple consecutive fatal errors
    if (consecutiveFatalErrors >= MAX_FATAL_ERRORS) {
      logger.fatal('Too many consecutive fatal database errors, shutting down', {
        error: err.message
      });
      // Give time for graceful shutdown
      setTimeout(() => {
        process.exit(1);
      }, 5000);
    }
  } else {
    // Transient error - reset counter and log warning
    consecutiveFatalErrors = 0;
    logger.warn('Transient database error, will retry', { error: err.message });
  }
});

// Connection health monitoring (every 30 seconds)
let healthCheckInterval: NodeJS.Timeout | null = null;

export function startHealthMonitoring(): void {
  if (healthCheckInterval) {
    return; // Already started
  }

  healthCheckInterval = setInterval(async () => {
    try {
      await dbCircuitBreaker.execute(async () => {
        await pool.query('SELECT 1');
      });
      consecutiveFatalErrors = 0; // Reset on successful health check
    } catch (err) {
      logger.warn('Health check failed, pool may be unhealthy', {
        error: err instanceof Error ? err.message : 'Unknown error',
        circuitState: dbCircuitBreaker.getState(),
      });
    }
  }, 30000); // Every 30 seconds
}

export function stopHealthMonitoring(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

/**
 * Check if the database pool is healthy
 */
export function isPoolHealthy(): boolean {
  return pool.totalCount > 0 && consecutiveFatalErrors < MAX_FATAL_ERRORS;
}

// Start health monitoring
if (process.env.NODE_ENV !== 'test') {
  startHealthMonitoring();
}

// Test connection (non-blocking)
if (process.env.NODE_ENV !== 'test') {
  pool.query('SELECT NOW()')
    .then(() => {
      logger.info('Database connected successfully');
      consecutiveFatalErrors = 0; // Reset on successful connection
    })
    .catch((err: Error) => {
      logger.error('Database connection failed', { error: err.message });
      if (err.message.includes('password') || err.message.includes('SASL')) {
        logger.error('Check your database credentials in .env file');
        logger.error('Make sure .env file exists in the root directory');
        logger.error('Restart the server after updating .env');
      }
    });
}

export default pool;

