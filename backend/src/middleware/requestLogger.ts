import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Request/Response logging middleware
 * Logs all API requests with method, path, user, timestamp, and response status/duration
 * Environment-aware: detailed in dev, minimal in prod
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  const { method, path, ip } = req;
  const user = (req as any).user?.username || 'anonymous';

  // Log request (only in development for detailed logging)
  if (process.env.NODE_ENV === 'development') {
    logger.info(`→ ${method} ${path}`, {
      user,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  // Capture response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;

    // Log response
    if (process.env.NODE_ENV === 'development') {
      // Detailed logging in development
      const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      logger[logLevel](`← ${method} ${path} ${statusCode}`, {
        user,
        duration: `${duration}ms`,
        statusCode,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Minimal logging in production (only errors and slow requests)
      if (statusCode >= 500 || duration > 1000) {
        logger.warn(`${method} ${path} ${statusCode} (${duration}ms)`, {
          user,
          ip,
        });
      }
    }
  });

  next();
};



