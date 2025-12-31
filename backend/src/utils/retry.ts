/**
 * Retry utility with exponential backoff for transient database errors
 * Handles deadlocks, timeouts, and connection errors automatically
 */

/**
 * Sleep utility for backoff delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable (transient failure)
 * @param error The error to check
 * @returns true if the error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (!error || !error.code) {
    return false;
  }
  
  // PostgreSQL error codes for retryable errors:
  // 40001: serialization_failure (deadlock)
  // 40P01: deadlock_detected
  // 57P03: cannot_connect_now (database is starting up)
  // 08006: connection_failure
  // 08003: connection_does_not_exist
  // 08001: sqlclient_unable_to_establish_sqlconnection
  // 08004: sqlserver_rejected_establishment_of_sqlconnection
  // 08007: transaction_resolution_unknown
  const retryableCodes = [
    '40001', // serialization_failure
    '40P01', // deadlock_detected
    '57P03', // cannot_connect_now
    '08006', // connection_failure
    '08003', // connection_does_not_exist
    '08001', // sqlclient_unable_to_establish_sqlconnection
    '08004', // sqlserver_rejected_establishment_of_sqlconnection
    '08007', // transaction_resolution_unknown
  ];
  
  return retryableCodes.includes(error.code);
}

export interface RetryOptions {
  maxAttempts?: number;
  backoffMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Execute a function with retry logic for transient failures
 * @param fn Function to execute
 * @param options Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts || 3;
  const backoffMs = options.backoffMs || 100;
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If error is not retryable, throw immediately
      if (!isRetryableError(error)) {
        throw lastError;
      }
      
      // If this was the last attempt, throw the error
      if (attempt >= maxAttempts) {
        throw lastError;
      }
      
      // Call onRetry callback if provided
      if (options.onRetry) {
        options.onRetry(attempt, lastError);
      }
      
      // Exponential backoff: 100ms, 200ms, 400ms, etc.
      const delay = backoffMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  // This should never be reached, but TypeScript requires it
  throw lastError!;
}

