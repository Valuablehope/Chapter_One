import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = (err as AppError).statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Log full error details (always log to server)
  logger.error(`Error ${statusCode}: ${err.message}`, {
    path: req.path,
    method: req.method,
    stack: isDevelopment ? err.stack : undefined,
    error: err instanceof Error ? err.name : 'Unknown',
  });

  // Sanitize error message for client
  let clientMessage = err.message || 'Internal server error';
  
  // In production, don't expose internal error details
  if (!isDevelopment) {
    // Don't expose database errors, stack traces, or internal details
    if (statusCode === 500) {
      clientMessage = 'An internal server error occurred. Please try again later.';
    } else if (err.message.includes('database') || err.message.includes('SQL') || err.message.includes('connection')) {
      clientMessage = 'A database error occurred. Please contact support if this persists.';
    } else if (err.message.includes('ECONNREFUSED') || err.message.includes('timeout')) {
      clientMessage = 'Service temporarily unavailable. Please try again later.';
    }
    // For 4xx errors, keep the original message as it's usually safe (validation errors, etc.)
  }

  res.status(statusCode).json({
    error: {
      message: clientMessage,
      statusCode,
      ...(isDevelopment && { 
        stack: err.stack,
        originalMessage: err.message,
      }),
    },
  });
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

