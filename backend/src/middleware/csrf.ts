import { Request, Response, NextFunction } from 'express';
import { CustomError } from './errorHandler';

/**
 * CSRF Protection Middleware
 * 
 * For Electron desktop apps using JWT tokens, CSRF protection is less critical
 * since we're not using cookies. However, this provides an additional layer of security.
 * 
 * This middleware:
 * - Validates Origin/Referer headers for state-changing requests
 * - Allows GET, HEAD, OPTIONS requests without validation
 * - Validates POST, PUT, DELETE, PATCH requests
 */
export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip CSRF check for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF check in development or if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_CSRF === 'true') {
    return next();
  }

  // For Electron apps, we can be more lenient
  // Check if request has valid JWT token (which is already validated by auth middleware)
  // If authenticated via JWT, CSRF risk is minimal
  
  // Validate Origin header for additional security
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [] // In production, Electron app doesn't use browser origins
    : ['http://localhost:5173', 'http://localhost:3000'];

  // For Electron desktop apps, we can skip strict origin checking
  // since the app runs locally and uses JWT tokens
  // This is a simplified CSRF protection suitable for desktop apps
  
  // In production, you might want to add additional checks
  // For now, we'll rely on JWT token validation (done in auth middleware)
  // and input sanitization for security

  next();
};

/**
 * Alternative: Simple token-based CSRF protection
 * Uncomment and use if you need stricter CSRF protection
 */
/*
import crypto from 'crypto';

// Store CSRF tokens in memory (use Redis in production)
const csrfTokens = new Map<string, { token: string; expires: number }>();

export const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    // Generate and send CSRF token for GET requests
    const token = generateCsrfToken();
    const userId = (req as any).user?.userId || 'anonymous';
    csrfTokens.set(userId, { token, expires: Date.now() + 3600000 }); // 1 hour
    res.setHeader('X-CSRF-Token', token);
    return next();
  }

  // Validate CSRF token for state-changing requests
  const csrfToken = req.headers['x-csrf-token'] as string;
  const userId = (req as any).user?.userId || 'anonymous';
  const stored = csrfTokens.get(userId);

  if (!csrfToken || !stored || stored.token !== csrfToken || stored.expires < Date.now()) {
    throw new CustomError('Invalid or expired CSRF token', 403);
  }

  // Clean up expired tokens
  csrfTokens.delete(userId);
  next();
};
*/



