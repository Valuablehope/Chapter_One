import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;
  data?: any; // Add optional data property

  constructor(message: string, statusCode: number = 500, dataOrOperational?: any, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    
    // Check if third parameter is an object (data) or boolean (isOperational)
    if (typeof dataOrOperational === 'object' && dataOrOperational !== null) {
      this.data = dataOrOperational;
      this.isOperational = isOperational;
    } else {
      this.isOperational = dataOrOperational !== undefined ? dataOrOperational : true;
    }
    
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
  
  // Short reference the user can quote so support can find the exact log line.
  const errorId = Math.random().toString(36).slice(2, 8).toUpperCase();

  // Log full error details (always log to server). Postgres errors carry the real cause
  // (code/detail/table/column/where) in extra fields — without them a 500 is undiagnosable.
  const pg = err as any;
  logger.error(`Error ${statusCode} [${errorId}]: ${err.message}`, {
    path: req.path,
    method: req.method,
    stack: statusCode >= 500 ? err.stack : undefined,
    error: err instanceof Error ? err.name : 'Unknown',
    pgCode: pg.code,
    pgDetail: pg.detail,
    pgTable: pg.table,
    pgColumn: pg.column,
    pgConstraint: pg.constraint,
    pgWhere: pg.where,
  });

  // Schema drift (missing column/table/constraint, wrong column type) means the database is behind
  // the app version. Flag it loudly in the log so it is obvious in application.log.
  const schemaDriftCodes = ['42703', '42P01', '42P10', '42804', '42883'];
  if (typeof pg.code === 'string' && schemaDriftCodes.includes(pg.code)) {
    logger.error(`[${errorId}] DATABASE SCHEMA MISMATCH (pg ${pg.code}): the database is out of date for this app version. Re-run migrations.`, {
      table: pg.table,
      column: pg.column,
    });
  }

  // Translate well-known Postgres failures into actionable client errors instead of a blind 500
  if (statusCode === 500 && typeof pg.code === 'string') {
    const pgMap: Record<string, [number, string]> = {
      '22P02': [400, 'One of the values has an invalid format (e.g. a number or ID).'],
      '22003': [400, 'A number is too large or has too many decimals for this field.'],
      '23503': [409, 'This record refers to an item that no longer exists (it may have been deleted).'],
      '23505': [409, 'This record already exists.'],
      '23514': [400, 'A value is outside the allowed range.'],
    };
    const mapped = pgMap[pg.code];
    if (mapped) {
      statusCode = mapped[0];
      err = Object.assign(new Error(mapped[1]), { statusCode });
    }
  }

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
      // The Postgres code (a 5-char SQLSTATE, no data) lets support triage from a screenshot alone
      const dbTag = typeof pg.code === 'string' && /^[0-9A-Z]{5}$/.test(pg.code) ? `, DB ${pg.code}` : '';
      clientMessage = `An internal server error occurred. Please try again later. (Ref: ${errorId}${dbTag})`;
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
      errorId,
      ...(err instanceof CustomError && err.data ? { data: err.data } : {}),
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

