import { BaseModel, PaginatedResult } from './BaseModel';

export interface Supplier {
  supplier_id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export class SupplierModel extends BaseModel {
  static async findAll(filters: SupplierFilters = {}): Promise<PaginatedResult<Supplier>> {
    const { page, limit, offset } = this.getPaginationParams(filters.page, filters.limit);
    
    let query = 'SELECT * FROM suppliers WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filters.search) {
      paramCount++;
      query += ` AND (
        name ILIKE $${paramCount} OR
        contact_name ILIKE $${paramCount} OR
        phone ILIKE $${paramCount} OR
        email ILIKE $${paramCount}
      )`;
      params.push(`%${filters.search}%`);
    }

    // Get total count
    const countQuery = this.buildCountQuery(query);
    const countResult = await this.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Add pagination
    paramCount++;
    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(limit);
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await this.query<Supplier>(query, params);
    return this.buildPaginatedResult(result.rows, total, page, limit);
  }

  static async findById(supplierId: string): Promise<Supplier | null> {
    const query = 'SELECT * FROM suppliers WHERE supplier_id = $1';
    const result = await this.query<Supplier>(query, [supplierId]);
    return result.rows[0] || null;
  }

  static async create(supplier: Partial<Supplier>): Promise<Supplier> {
    const query = `
      INSERT INTO suppliers (name, contact_name, phone, email)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [
      supplier.name,
      supplier.contact_name || null,
      supplier.phone || null,
      supplier.email || null,
    ];
    const result = await this.query<Supplier>(query, values);
    return result.rows[0];
  }

  static async update(supplierId: string, updates: Partial<Supplier>): Promise<Supplier> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (updates.name !== undefined) {
      paramCount++;
      fields.push(`name = $${paramCount}`);
      values.push(updates.name);
    }
    if (updates.contact_name !== undefined) {
      paramCount++;
      fields.push(`contact_name = $${paramCount}`);
      values.push(updates.contact_name);
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

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // Add updated_at without incrementing paramCount since CURRENT_TIMESTAMP doesn't use a parameter
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    paramCount++;
    values.push(supplierId);

    const query = `
      UPDATE suppliers
      SET ${fields.join(', ')}
      WHERE supplier_id = $${paramCount}
      RETURNING *
    `;
    const result = await this.query<Supplier>(query, values);
    return result.rows[0];
  }

  static async delete(supplierId: string): Promise<boolean> {
    const query = 'DELETE FROM suppliers WHERE supplier_id = $1';
    const result = await this.query(query, [supplierId]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}




