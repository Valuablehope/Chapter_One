/**
 * Sanitize user input for JSON APIs: strip null bytes and obvious script/injection
 * patterns. We do not HTML-entity-encode here — stored values must remain plain
 * text; escaping belongs at render time (e.g. React). Entity-encoding request
 * bodies broke identifiers like IANA timezones (`Asia/Dubai` → `&#x2F;` →
 * compounded `&amp;` on each save).
 */
export function sanitizeInput(input: string | null | undefined): string {
  if (!input) return '';
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
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
 * Undo legacy HTML-entity encoding applied to plain text (e.g. stores.timezone).
 * Iterates until stable so compounded `&amp;` chains decode fully.
 */
export function repairHtmlEntityOverEncoding(input: string): string {
  if (!input) return input;
  let s = input;
  const maxPasses = 32;
  for (let i = 0; i < maxPasses; i++) {
    const next = s
      .replace(/&amp;/gi, '&')
      .replace(/&#x2F;/gi, '/')
      .replace(/&#47;/g, '/')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'");
    if (next === s) break;
    s = next;
  }
  return s.trim();
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

