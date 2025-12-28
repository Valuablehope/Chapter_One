import { BaseModel, PaginatedResult } from './BaseModel';

export interface AppUser {
  user_id: string;
  username: string;
  full_name: string;
  role: 'cashier' | 'manager' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface UserFilters {
  search?: string;
  role?: 'cashier' | 'manager' | 'admin';
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export class UserModel extends BaseModel {
  static async findAll(filters: UserFilters = {}): Promise<PaginatedResult<AppUser>> {
    const { page, limit, offset } = this.getPaginationParams(filters.page, filters.limit);
    
    let query = 'SELECT user_id, username, full_name, role, is_active, created_at FROM app_users WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filters.search) {
      paramCount++;
      query += ` AND (
        username ILIKE $${paramCount} OR
        full_name ILIKE $${paramCount}
      )`;
      params.push(`%${filters.search}%`);
    }

    if (filters.role) {
      paramCount++;
      query += ` AND role = $${paramCount}`;
      params.push(filters.role);
    }

    if (filters.is_active !== undefined) {
      paramCount++;
      query += ` AND is_active = $${paramCount}`;
      params.push(filters.is_active);
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

    const result = await this.query<AppUser>(query, params);
    return this.buildPaginatedResult(result.rows, total, page, limit);
  }

  static async findById(userId: string): Promise<AppUser | null> {
    const query = 'SELECT user_id, username, full_name, role, is_active, created_at FROM app_users WHERE user_id = $1';
    const result = await this.query<AppUser>(query, [userId]);
    return result.rows[0] || null;
  }

  static async create(user: Partial<AppUser> & { password_hash: string }): Promise<AppUser> {
    const query = `
      INSERT INTO app_users (username, full_name, role, password_hash, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING user_id, username, full_name, role, is_active, created_at
    `;
    const values = [
      user.username?.toLowerCase(),
      user.full_name,
      user.role || 'cashier',
      user.password_hash,
      user.is_active !== undefined ? user.is_active : true,
    ];
    const result = await this.query<AppUser>(query, values);
    return result.rows[0];
  }

  static async update(userId: string, updates: Partial<AppUser> & { password_hash?: string }): Promise<AppUser> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (updates.full_name !== undefined) {
      paramCount++;
      fields.push(`full_name = $${paramCount}`);
      values.push(updates.full_name);
    }
    if (updates.role !== undefined) {
      paramCount++;
      fields.push(`role = $${paramCount}`);
      values.push(updates.role);
    }
    if (updates.is_active !== undefined) {
      paramCount++;
      fields.push(`is_active = $${paramCount}`);
      values.push(updates.is_active);
    }
    if (updates.password_hash !== undefined) {
      paramCount++;
      fields.push(`password_hash = $${paramCount}`);
      values.push(updates.password_hash);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    paramCount++;
    values.push(userId);

    const query = `
      UPDATE app_users
      SET ${fields.join(', ')}
      WHERE user_id = $${paramCount}
      RETURNING user_id, username, full_name, role, is_active, created_at
    `;
    const result = await this.query<AppUser>(query, values);
    return result.rows[0];
  }

  static async delete(userId: string): Promise<boolean> {
    const query = 'DELETE FROM app_users WHERE user_id = $1';
    const result = await this.query(query, [userId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async checkUsernameExists(username: string, excludeUserId?: string): Promise<boolean> {
    let query = 'SELECT user_id FROM app_users WHERE LOWER(username) = $1';
    const params: any[] = [username.toLowerCase()];
    
    if (excludeUserId) {
      query += ' AND user_id != $2';
      params.push(excludeUserId);
    }
    
    const result = await this.query(query, params);
    return result.rows.length > 0;
  }
}









