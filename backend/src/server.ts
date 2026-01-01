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
import { errorHandler } from './middleware/errorHandler';
import { sanitizeMiddleware } from './utils/sanitize';
import { requestLogger } from './middleware/requestLogger';
import { csrfProtection } from './middleware/csrf';

// Load environment variables from root directory
import * as path from 'path';
import * as fs from 'fs';

// Find root directory by looking for .env file
// Go up from backend/src/ (2 levels) or backend/dist/ (2 levels)
function findEnvFile(): string {
  let currentDir = __dirname;
  const maxDepth = 5; // Prevent infinite loop
  
  for (let i = 0; i < maxDepth; i++) {
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached filesystem root
    currentDir = parentDir;
  }
  
  // Fallback: try root directory (2 levels up from backend/src)
  return path.resolve(__dirname, '../../.env');
}

const envPath = findEnvFile();
dotenv.config({ path: envPath });

// Debug log
if (process.env.NODE_ENV !== 'production') {
  console.log(`📄 Loading .env from: ${envPath}`);
}

const app: Express = express();
const PORT = process.env.PORT || process.env.API_PORT || 3001;

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // In production, allow requests from Electron (no origin) and localhost
    if (!origin || origin.startsWith('file://') || origin.startsWith('app://')) {
      callback(null, true);
    } else if (process.env.NODE_ENV !== 'production') {
      // In development, allow Vite dev server
      callback(null, true);
    } else {
      callback(null, true); // Allow all in production for Electron
    }
  },
  credentials: true,
}));
app.use(cookieParser()); // Parse cookies
app.use(morgan('dev')); // HTTP request logging
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

// 404 handler (must be before error handler)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  stopHealthMonitoring();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  stopHealthMonitoring();
  await pool.end();
  process.exit(0);
});

