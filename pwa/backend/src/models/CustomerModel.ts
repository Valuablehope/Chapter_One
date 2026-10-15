import { BaseModel, PaginatedResult } from './BaseModel';
import { QueryResult } from 'pg';

export interface Customer {
  customer_id: string;
  full_name?: string;
  phone?: string;
  email?: string;
  created_at: string;
  updated_at: string;
  total_orders: number;
  total_spent: number;
  last_order?: string;
  notes?: string;
}

export interface CustomerFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export class CustomerModel extends BaseModel {
  static async findAll(filters: CustomerFilters = {}): Promise<PaginatedResult<Customer>> {
    const { page, limit, offset } = this.getPaginationParams(filters.page, filters.limit);

    let query = 'SELECT * FROM customers WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filters.search) {
      paramCount++;
      query += ` AND (
        full_name ILIKE $${paramCount} OR
        phone ILIKE $${paramCount} OR
        email ILIKE $${paramCount}
      )`;
      params.push(`%${filters.search}%`);
    }

    // Get total count
    const countQuery = this.buildCountQuery(query);
    const countResult = await this.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Add sorting and pagination
    if (filters.search && filters.search.trim().length > 0) {
      const searchTerm = filters.search.trim();

      paramCount++;
      const exactParamIdx = paramCount;
      params.push(searchTerm);

      paramCount++;
      const startsWithParamIdx = paramCount;
      params.push(`${searchTerm}%`);

      query += ` ORDER BY 
        CASE 
          WHEN full_name ILIKE $${exactParamIdx} THEN 1
          WHEN phone ILIKE $${exactParamIdx} THEN 2
          WHEN email ILIKE $${exactParamIdx} THEN 3
          WHEN full_name ILIKE $${startsWithParamIdx} THEN 4
          ELSE 5
        END ASC, created_at DESC`;
    } else {
      query += ` ORDER BY created_at DESC`;
    }

    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(limit);
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await this.query<Customer>(query, params);
    return this.buildPaginatedResult(result.rows, total, page, limit);
  }

  static async findById(customerId: string): Promise<Customer | null> {
    const query = 'SELECT * FROM customers WHERE customer_id = $1';
    const result = await this.query<Customer>(query, [customerId]);
    return result.rows[0] || null;
  }

  static async create(customer: Partial<Customer>): Promise<Customer> {
    const query = `
      INSERT INTO customers (full_name, phone, email, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [
      customer.full_name || null,
      customer.phone || null,
      customer.email || null,
      customer.notes || null,
    ];
    const result = await this.query<Customer>(query, values);
    return result.rows[0];
  }

  static async update(customerId: string, updates: Partial<Customer>): Promise<Customer> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (updates.full_name !== undefined) {
      paramCount++;
      fields.push(`full_name = $${paramCount}`);
      values.push(updates.full_name);
    }
    if (updates.phone !== undefined) {
      paramCount++;
      fields.push(`phone = $${paramCount}`);
      values.push(updates.phone);
    }
    if (updates.email !== undefined) {
      paramCount++;
      fields.push(`email = $${paramCount}`);
      values.push(updates.email);
    }
    if (updates.notes !== undefined) {
      paramCount++;
      fields.push(`notes = $${paramCount}`);
      values.push(updates.notes);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // Add updated_at without incrementing paramCount since CURRENT_TIMESTAMP doesn't use a parameter
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    paramCount++;
    values.push(customerId);

    const query = `
      UPDATE customers
      SET ${fields.join(', ')}
      WHERE customer_id = $${paramCount}
      RETURNING *
    `;
    const result = await this.query<Customer>(query, values);
    return result.rows[0];
  }

  static async delete(customerId: string): Promise<boolean> {
    const query = 'DELETE FROM customers WHERE customer_id = $1';
    const result = await this.query(query, [customerId]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}




