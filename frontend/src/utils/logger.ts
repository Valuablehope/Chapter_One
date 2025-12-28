/**
 * Logger Utility
 * Environment-aware logging that wraps console methods
 * No-op in production, full logging in development
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface Logger {
  log: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * Creates a logger function for a specific level
 */
const createLogger = (level: LogLevel): (...args: any[]) => void => {
  if (isDevelopment && console[level]) {
    return (...args: any[]) => {
      console[level](...args);
    };
  }
  // No-op in production
  return () => {};
};

/**
 * Logger instance with environment-aware methods
 */
export const logger: Logger = {
  log: createLogger('log'),
  info: createLogger('info'),
  warn: createLogger('warn'),
  error: createLogger('error'),
  debug: createLogger('debug'),
};

export default logger;



