import { pool } from '../config/database';
import { QueryResult, QueryResultRow } from 'pg';
import { dbCircuitBreaker } from '../utils/circuitBreaker';
import { logger } from '../utils/logger';

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class BaseModel {
  /**
   * Execute a simple query using pool.query() for better connection pool management
   * Use this for read queries and simple operations that don't require transactions
   * @param text SQL query text
   * @param params Query parameters
   * @param timeout Optional timeout in milliseconds (default: 30 seconds from pool config)
   */
  protected static async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    timeout?: number
  ): Promise<QueryResult<T>> {
    // For queries with timeout, we need to use a transaction to set statement_timeout
    if (timeout) {
      return await dbCircuitBreaker.execute(async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(`SET LOCAL statement_timeout = ${timeout}`);
          const result = await client.query<T>(text, params);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          // Always rollback on error
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            // Log rollback error but don't mask original error
            logger.error('Failed to rollback transaction', {
              error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
            });
          }
          throw error;
        } finally {
          // Always release client, even if rollback failed
          // This is critical to prevent connection pool exhaustion
          if (client) {
            try {
              client.release();
            } catch (releaseError) {
              // Log but don't throw - we've already handled the transaction error
              logger.error('Failed to release database client', {
                error: releaseError instanceof Error ? releaseError.message : 'Unknown error',
              });
            }
          }
        }
      });
    }
    
    // For queries without timeout, use pool.query() with circuit breaker
    return await dbCircuitBreaker.execute(async () => {
      return await pool.query<T>(text, params);
    });
  }

  /**
   * Get a client from the pool for transactions
   * Use this when you need to perform multiple queries in a transaction
   * Remember to release the client when done!
   */
  protected static async getClient() {
    return await pool.connect();
  }

  protected static getPaginationParams(
    page?: number,
    limit?: number
  ): { offset: number; limit: number; page: number } {
    const pageNum = page && page > 0 ? page : 1;
    const limitNum = limit && limit > 0 ? limit : 20;
    const offset = (pageNum - 1) * limitNum;

    return {
      offset,
      limit: limitNum,
      page: pageNum,
    };
  }

  protected static buildPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): PaginatedResult<T> {
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Builds a count query from a base query by using a subquery
   * This is more reliable than regex replacement for complex queries with JOINs
   * 
   * @param baseQuery - The full SELECT query (without ORDER BY, LIMIT, OFFSET)
   * @returns A COUNT(*) query wrapped in a subquery
   */
  protected static buildCountQuery(baseQuery: string): string {
    // Remove ORDER BY, LIMIT, and OFFSET clauses for count query
    const cleanedQuery = baseQuery
      .replace(/\s+ORDER\s+BY\s+[^$]+/i, '')
      .replace(/\s+LIMIT\s+\$\d+/i, '')
      .replace(/\s+OFFSET\s+\$\d+/i, '');
    
    // Wrap in subquery for accurate count
    return `SELECT COUNT(*) FROM (${cleanedQuery}) AS count_subquery`;
  }
}

