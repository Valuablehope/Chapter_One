import { pool } from '../config/database';
import { QueryResult, QueryResultRow } from 'pg';

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
  protected static async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    return pool.query<T>(text, params);
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

