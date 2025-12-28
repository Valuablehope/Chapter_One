import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter for authentication endpoints
 * Prevents brute force attacks by limiting login attempts
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10), // 5 attempts per window
  message: {
    error: {
      message: 'Too many login attempts, please try again after 15 minutes',
      statusCode: 429,
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        message: 'Too many login attempts, please try again after 15 minutes',
        statusCode: 429,
        retryAfter: Math.ceil(15 * 60), // seconds
      },
    });
  },
});

/**
 * General API rate limiter
 * Protects all API endpoints from abuse
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT_MAX || '100', 10), // 100 requests per window
  message: {
    error: {
      message: 'Too many requests, please try again later',
      statusCode: 429,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});



