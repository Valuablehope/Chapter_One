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
  let statusCode = (err as AppError).statusCode || 500;
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
  
  // Check for specific database lock errors
  const errorMessage = err.message?.toLowerCase() || '';
  if (errorMessage.includes('lock') || errorMessage.includes('deadlock') || errorMessage.includes('serialization')) {
    clientMessage = 'The system is processing another transaction. Please try again in a moment.';
    // Set appropriate status code for lock errors
    if (statusCode === 500) {
      statusCode = 503; // Service Unavailable for lock errors
    }
  }
  
  // Check for stock-related errors
  if (errorMessage.includes('insufficient stock') || errorMessage.includes('out of stock')) {
    // Stock errors should be 400 Bad Request (client error)
    statusCode = 400;
    // Keep the original message as it contains useful details (product name, available quantity)
    clientMessage = err.message;
  }
  
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

