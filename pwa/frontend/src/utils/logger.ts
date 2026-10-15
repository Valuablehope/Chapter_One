/**
 * Logger Utility
 * Environment-aware logging that wraps console methods.
 * console output is dev-only, but warn/error are always additionally
 * forwarded to the durable electron-log file (via window.electronAPI.log)
 * so production incidents leave a diagnosable trail instead of vanishing —
 * console.log alone is invisible once a client closes the app.
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

function formatArgs(args: any[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.message}\n${a.stack || ''}`;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

function forwardToElectronLog(level: 'warn' | 'error', args: any[]): void {
  try {
    window.electronAPI?.log?.(level, formatArgs(args));
  } catch {
    // electronAPI unavailable (e.g. running in a plain browser) — nothing more we can do
  }
}

/**
 * Creates a logger function for a specific level
 */
const createLogger = (level: LogLevel): (...args: any[]) => void => {
  const forwards = level === 'warn' || level === 'error';

  return (...args: any[]) => {
    if (isDevelopment && console[level]) {
      console[level](...args);
    }
    if (forwards) {
      forwardToElectronLog(level, args);
    }
  };
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



