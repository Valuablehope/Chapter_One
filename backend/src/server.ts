import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { pool, stopHealthMonitoring } from './config/database';
import apiRoutes from './routes';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import productTypesRoutes from './routes/productTypes';
import customerRoutes from './routes/customers';
import supplierRoutes from './routes/suppliers';
import barcodeRoutes from './routes/barcode';
import salesRoutes from './routes/sales';
import purchasesRoutes from './routes/purchases';
import reportsRoutes from './routes/reports';
import adminRoutes from './routes/admin';
import licenseRoutes from './routes/license';
import stockRoutes from './routes/stock';
import storesRoutes from './routes/stores';
import menusRoutes from './routes/menus';
import { StoreSettingsModel } from './models/StoreSettingsModel';
import { errorHandler } from './middleware/errorHandler';
import { sanitizeMiddleware } from './utils/sanitize';
import { requestLogger } from './middleware/requestLogger';
import { csrfProtection } from './middleware/csrf';
import { logger } from './utils/logger';

// Load environment variables from root directory
import * as path from 'path';
import * as fs from 'fs';

// Find root directory by looking for .env file
// Go up from backend/src/ (2 levels) or backend/dist/ (2 levels)

function findEnvFile(): string | null {
  // 1. Check current directory and parents (for development)
  let currentDir = __dirname;
  const maxDepth = 5;

  for (let i = 0; i < maxDepth; i++) {
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) return envPath;
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  // 2. Check explicitly provided RESOURCES_PATH
  if (process.env.RESOURCES_PATH) {
    const resourcesEnvPath = path.join(process.env.RESOURCES_PATH, '.env');
    if (fs.existsSync(resourcesEnvPath)) return resourcesEnvPath;
  }

  // 3. Check production resources path (Electron)
  // In production, __dirname is .../resources/app.asar.unpacked/backend/dist
  // We want .../resources/.env

  // Try going up 3 levels to reach 'resources' from 'dist'
  const resourcesEnvPath = path.resolve(__dirname, '../../../.env');
  if (fs.existsSync(resourcesEnvPath)) return resourcesEnvPath;

  // Try going up 4 levels (just in case)
  const rootEnvPath = path.resolve(__dirname, '../../../../.env');
  if (fs.existsSync(rootEnvPath)) return rootEnvPath;

  return null;
}

const envPath = findEnvFile();
if (envPath) {
  dotenv.config({ path: envPath });
}

const isProduction = process.env.NODE_ENV === 'production';

// Validate required environment variables in production
if (isProduction) {
  // Check if we have minimal config
  const hasJwtSecret = !!process.env.JWT_SECRET;

  if (!hasJwtSecret) {
    const requiredVars = ['JWT_SECRET', 'LICENSE_ENCRYPTION_KEY'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      logger.error('Application cannot start in production without these variables.');
      process.exit(1);
    }
  }
}

// Debug log (only in development)
if (!isProduction) {
  logger.info(`📄 Loading .env from: ${envPath}`);
}

const app: Express = express();
const PORT = process.env.PORT || process.env.API_PORT || 3001;

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // In production, only allow requests from Electron (no origin) or file:///app:// protocols
    if (!origin || origin.startsWith('file://') || origin.startsWith('app://')) {
      callback(null, true);
    } else if (!isProduction) {
      // In development, allow Vite dev server and localhost
      callback(null, true);
    } else {
      // In production, reject other origins for security
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(cookieParser()); // Parse cookies
// Use appropriate logging format based on environment
app.use(morgan(isProduction ? 'combined' : 'dev')); // HTTP request logging
app.use(requestLogger); // Custom request/response logging
app.use(express.json({ limit: '10mb' })); // Request size limit
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Request size limit
app.use(sanitizeMiddleware); // XSS protection - sanitize all inputs
app.use(csrfProtection); // CSRF protection - generates tokens on GET, validates on POST/PUT/DELETE/PATCH

// Root endpoint for wait-on health checks
app.head('/', (req: Request, res: Response) => {
  res.status(200).end();
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Chapter One POS API v4.0',
    version: '4.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth',
    },
  });
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Test database connection
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API routes
app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-types', productTypesRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/barcode', barcodeRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/stores', storesRoutes);
app.use('/api/menus', menusRoutes);

// 404 handler (must be before error handler)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Validate database connection before starting server
async function startServer(): Promise<void> {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    logger.info('✅ Database connection validated');

    const storeSettingsAudit = await StoreSettingsModel.auditRestaurantSchema();
    if (!storeSettingsAudit.ok) {
      logger.warn('⚠️  store_settings restaurant schema mismatch detected', {
        schema: storeSettingsAudit.schema,
        missingColumns: storeSettingsAudit.missingColumns,
        invalidTypes: storeSettingsAudit.invalidTypes,
      });
      logger.warn('Apply database/migrations/008_ensure_public_store_settings_restaurant_columns.sql and restart backend.');
    } else {
      logger.info(`✅ store_settings restaurant schema validated in schema "${storeSettingsAudit.schema}"`);
    }
  } catch (error) {
    logger.warn('⚠️  Database connection failed during startup:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    logger.warn('Backend will continue to run, but API requests requiring DB will fail.');
    logger.warn('Please check your database configuration in the .env file.');
    // DO NOT exit(1) here in production - keep the server running so we don't get ERR_CONNECTION_REFUSED
    if (!isProduction) {
      // In dev, we still might want to exit to force fix
      // but let's keep it running for now for consistency
    }
  }

  // Start server
  const server = app.listen(Number(PORT), '127.0.0.1', () => {
    logger.info(`🚀 Server running on http://127.0.0.1:${PORT}`);
    logger.info(`📊 Health check: http://127.0.0.1:${PORT}/health`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`❌ Port ${PORT} is already in use.`);
      logger.error('Please kill the process using this port or use a different port.');
    } else {
      logger.error('❌ Server error:', error);
    }
    process.exit(1);
  });
}

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  stopHealthMonitoring();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  stopHealthMonitoring();
  await pool.end();
  process.exit(0);
});

