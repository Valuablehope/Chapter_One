/**
 * Sanitize user input to prevent XSS attacks
 * Removes potentially dangerous HTML/JavaScript while preserving safe text
 * 
 * This is a basic sanitizer that:
 * - Escapes HTML entities
 * - Removes script tags and event handlers
 * - Strips dangerous characters
 */
export function sanitizeInput(input: string | null | undefined): string {
  if (!input) return '';
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Escape HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  // Remove script tags and event handlers (case-insensitive)
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '');
  
  return sanitized.trim();
}

/**
 * Sanitize object properties recursively
 * Useful for sanitizing request bodies
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeInput(sanitized[key]) as any;
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeObject(sanitized[key]) as any;
    } else if (Array.isArray(sanitized[key])) {
      sanitized[key] = sanitized[key].map((item: any) => 
        typeof item === 'string' ? sanitizeInput(item) : 
        typeof item === 'object' && item !== null ? sanitizeObject(item) : 
        item
      ) as any;
    }
  }
  
  return sanitized;
}

import { Request, Response, NextFunction } from 'express';

/**
 * Sanitize middleware for Express
 * Sanitizes req.body, req.query, and req.params
 */

export const sanitizeMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query as Record<string, any>) as any;
  }

  // Sanitize route parameters
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
};

