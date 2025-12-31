import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { CustomError } from './errorHandler';

/**
 * CSRF Protection Middleware
 * 
 * Token-based CSRF protection for state-changing requests.
 * Since we're using httpOnly cookies, CSRF protection is critical.
 * 
 * This middleware:
 * - Generates CSRF tokens on GET requests
 * - Validates CSRF tokens on POST, PUT, DELETE, PATCH requests
 * - Uses in-memory storage (upgrade to Redis for multi-instance deployments)
 */

// Store CSRF tokens in memory (use Redis in production for multi-instance deployments)
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of csrfTokens.entries()) {
    if (data.expires < now) {
      csrfTokens.delete(userId);
    }
  }
}, 5 * 60 * 1000); // 5 minutes

export const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip CSRF check for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    // Generate and send CSRF token for GET requests
    // Only generate if user is authenticated (to avoid unnecessary tokens)
    const userId = (req as any).user?.userId;
    if (userId) {
      const token = generateCsrfToken();
      csrfTokens.set(userId, { token, expires: Date.now() + 3600000 }); // 1 hour
      res.setHeader('X-CSRF-Token', token);
    }
    return next();
  }

  // Skip CSRF check in development if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_CSRF === 'true') {
    return next();
  }

  // Validate CSRF token for state-changing requests
  const csrfToken = req.headers['x-csrf-token'] as string;
  const userId = (req as any).user?.userId;

  // If user is authenticated, require CSRF token
  if (userId) {
    if (!csrfToken) {
      throw new CustomError('CSRF token is required', 403);
    }

    const stored = csrfTokens.get(userId);
    if (!stored || stored.token !== csrfToken || stored.expires < Date.now()) {
      throw new CustomError('Invalid or expired CSRF token', 403);
    }

    // Generate new token after validation (not one-time use)
    // This allows multiple requests in quick succession while maintaining security
    // The token is still validated, but a new one is issued for the next request
    const newToken = generateCsrfToken();
    csrfTokens.set(userId, { token: newToken, expires: Date.now() + 3600000 }); // 1 hour
    res.setHeader('X-CSRF-Token', newToken);
  }

  next();
};



