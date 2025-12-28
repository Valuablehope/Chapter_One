import { BaseModel, PaginatedResult } from './BaseModel';

export interface Store {
  store_id: string;
  code: string;
  name: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  timezone?: string; // From stores table
  // Store Settings Fields (from store_settings table)
  currency_code?: string;
  tax_inclusive?: boolean;
  theme?: string;
  tax_rate?: number | null;
  receipt_footer?: string | null;
  auto_backup?: boolean;
  backup_frequency?: string;
  low_stock_threshold?: number;
  show_stock?: boolean;
  auto_add_qty?: boolean;
  allow_negative?: boolean;
  paper_size?: string;
  auto_print?: boolean;
  receipt_header?: string;
}

export interface StoreFilters {
  search?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export class StoreModel extends BaseModel {
  // Cache for available store_settings columns
  private static availableSettingsColumns: Set<string> | null = null;

  // Get available columns from store_settings table
  private static async getAvailableSettingsColumns(): Promise<Set<string>> {
    if (this.availableSettingsColumns !== null) {
      return this.availableSettingsColumns;
    }

    try {
      const query = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'store_settings'
      `;
      const result = await this.query<{ column_name: string }>(query);
      this.availableSettingsColumns = new Set(result.rows.map(row => row.column_name));
      return this.availableSettingsColumns;
    } catch (error) {
      // If query fails, return empty set (will only select from stores table)
      console.warn('Could not fetch store_settings columns, using defaults');
      this.availableSettingsColumns = new Set();
      return this.availableSettingsColumns;
    }
  }

  // Build SELECT clause for store_settings columns dynamically
  private static async buildSettingsSelect(): Promise<string> {
    const availableColumns = await this.getAvailableSettingsColumns();
    const settingsColumns: string[] = [];

    // Always try to select these (they should exist based on schema)
    const columnMap: { [key: string]: string } = {
      currency_code: 'ss.currency_code',
      tax_inclusive: 'ss.tax_inclusive',
      theme: 'ss.theme',
      tax_rate: 'ss.tax_rate',
      receipt_footer: 'ss.receipt_footer',
      auto_backup: 'ss.auto_backup',
      backup_frequency: 'ss.backup_frequency',
      low_stock_threshold: 'ss.low_stock_threshold',
      // Optional columns that might not exist
      show_stock: 'ss.show_stock',
      auto_add_qty: 'ss.auto_add_qty',
      allow_negative: 'ss.allow_negative',
      paper_size: 'ss.paper_size',
      auto_print: 'ss.auto_print',
      receipt_header: 'ss.receipt_header',
    };

    for (const [column, select] of Object.entries(columnMap)) {
      if (availableColumns.has(column)) {
        settingsColumns.push(select);
      }
    }

    return settingsColumns.length > 0 ? settingsColumns.join(',\n        ') : '';
  }

  static async findAll(filters: StoreFilters = {}): Promise<PaginatedResult<Store>> {
    const { page, limit, offset } = this.getPaginationParams(filters.page, filters.limit);
    
    // Get dynamic settings columns
    const settingsSelect = await this.buildSettingsSelect();
    
    // Build query with dynamic column selection
    let query = `
      SELECT 
        s.store_id,
        s.code,
        s.name,
        s.address,
        s.timezone,
        s.is_active,
        s.created_at${settingsSelect ? ',\n        ' + settingsSelect : ''}
      FROM stores s
      LEFT JOIN store_settings ss ON s.store_id = ss.store_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (filters.search) {
      paramCount++;
      query += ` AND (
        name ILIKE $${paramCount} OR
        code ILIKE $${paramCount} OR
        address ILIKE $${paramCount}
      )`;
      params.push(`%${filters.search}%`);
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

    const result = await this.query<Store>(query, params);
    return this.buildPaginatedResult(result.rows, total, page, limit);
  }

  static async findById(storeId: string): Promise<Store | null> {
    // Get dynamic settings columns
    const settingsSelect = await this.buildSettingsSelect();
    
    // Build query with dynamic column selection
    const query = `
      SELECT 
        s.store_id,
        s.code,
        s.name,
        s.address,
        s.timezone,
        s.is_active,
        s.created_at${settingsSelect ? ',\n        ' + settingsSelect : ''}
      FROM stores s
      LEFT JOIN store_settings ss ON s.store_id = ss.store_id
      WHERE s.store_id = $1
    `;
    const result = await this.query<Store>(query, [storeId]);
    return result.rows[0] || null;
  }

  // Get store settings (alias for findById, but explicit for clarity)
  static async getStoreSettings(storeId: string): Promise<Store | null> {
    return this.findById(storeId);
  }

  static async create(store: Partial<Store>): Promise<Store> {
    // Only use columns that exist: store_id, code, name, address, timezone, is_active, created_at
    const query = `
      INSERT INTO stores (code, name, address, timezone, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      store.code,
      store.name,
      store.address || null,
      store.timezone || 'UTC',
      store.is_active !== undefined ? store.is_active : true,
    ];
    const result = await this.query<Store>(query, values);
    return result.rows[0];
  }

  static async update(storeId: string, updates: Partial<Store>): Promise<Store> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // Only update columns that exist in the database:
    // Existing: store_id, code, name, address, timezone, is_active, created_at
    // Skip: phone, email, updated_at, currency_code, tax_inclusive, theme,
    //       tax_rate, receipt_footer, auto_backup, backup_frequency

    if (updates.code !== undefined) {
      paramCount++;
      fields.push(`code = $${paramCount}`);
      values.push(updates.code);
    }
    if (updates.name !== undefined) {
      paramCount++;
      fields.push(`name = $${paramCount}`);
      values.push(updates.name);
    }
    if (updates.address !== undefined) {
      paramCount++;
      fields.push(`address = $${paramCount}`);
      values.push(updates.address);
    }
    if (updates.timezone !== undefined) {
      paramCount++;
      fields.push(`timezone = $${paramCount}`);
      values.push(updates.timezone);
    }
    if (updates.is_active !== undefined) {
      paramCount++;
      fields.push(`is_active = $${paramCount}`);
      values.push(updates.is_active);
    }

    // Skip all other fields as they don't exist in the database

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    paramCount++;
    values.push(storeId);

    const query = `
      UPDATE stores
      SET ${fields.join(', ')}
      WHERE store_id = $${paramCount}
      RETURNING *
    `;
    const result = await this.query<Store>(query, values);
    return result.rows[0];
  }

  static async delete(storeId: string): Promise<boolean> {
    const query = 'DELETE FROM stores WHERE store_id = $1';
    const result = await this.query(query, [storeId]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}




