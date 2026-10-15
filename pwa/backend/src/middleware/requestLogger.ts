import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { decodeToken } from '../utils/jwt';

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
  
  // Try to get user from req.user (set by authenticate middleware)
  // If not available, try to decode from token in Authorization header
  let user = (req as any).user?.username;
  
  if (!user) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = decodeToken(token);
      if (decoded) {
        user = decoded.username;
      }
    }
  }
  
  const username = user || 'anonymous';

  // Log request (only in development for detailed logging)
  if (process.env.NODE_ENV === 'development') {
    logger.info(`→ ${method} ${path}`, {
      user: username,
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
        user: username,
        duration: `${duration}ms`,
        statusCode,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Minimal logging in production (only errors and slow requests)
      if (statusCode >= 500 || duration > 1000) {
        logger.warn(`${method} ${path} ${statusCode} (${duration}ms)`, {
          user: username,
          ip,
        });
      }
    }
  });

  next();
};



