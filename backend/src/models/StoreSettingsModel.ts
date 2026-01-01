import { BaseModel } from './BaseModel';

export interface StoreSettings {
  store_id: string;
  currency_code: string;
  tax_inclusive: boolean;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
  theme: string;
  // timezone belongs in stores table, not store_settings
  tax_rate: number | null;
  receipt_footer: string | null;
  auto_backup: boolean;
  backup_frequency: string;
  show_stock: boolean;
  auto_add_qty: boolean;
  allow_negative: boolean;
  paper_size: string;
  auto_print: boolean;
  receipt_header: string;
}

export interface StoreSettingsInput {
  currency_code?: string;
  tax_inclusive?: boolean;
  low_stock_threshold?: number;
  theme?: string;
  // timezone belongs in stores table, not store_settings
  tax_rate?: number | null;
  receipt_footer?: string | null;
  auto_backup?: boolean;
  backup_frequency?: string;
  show_stock?: boolean;
  auto_add_qty?: boolean;
  allow_negative?: boolean;
  paper_size?: string;
  auto_print?: boolean;
  receipt_header?: string;
}

export class StoreSettingsModel extends BaseModel {
  // Cache for available columns
  private static availableColumns: Set<string> | null = null;

  // Get available columns from store_settings table
  private static async getAvailableColumns(): Promise<Set<string>> {
    if (this.availableColumns !== null) {
      return this.availableColumns;
    }

    try {
      const query = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'store_settings'
      `;
      const result = await this.query<{ column_name: string }>(query);
      this.availableColumns = new Set(result.rows.map((row: { column_name: string }) => row.column_name));
      return this.availableColumns;
    } catch (error) {
      console.warn('Could not fetch store_settings columns, using defaults');
      this.availableColumns = new Set();
      return this.availableColumns;
    }
  }

  static async findByStoreId(storeId: string): Promise<StoreSettings | null> {
    const query = 'SELECT * FROM store_settings WHERE store_id = $1';
    const result = await this.query<StoreSettings>(query, [storeId]);
    return result.rows[0] || null;
  }

  static async create(storeId: string, settings: StoreSettingsInput): Promise<StoreSettings> {
    const fields: string[] = ['store_id'];
    const values: any[] = [storeId];
    let paramCount = 1;

    const availableColumns = await this.getAvailableColumns();

    // Only add fields that exist in the database
    if (settings.currency_code !== undefined && availableColumns.has('currency_code')) {
      paramCount++;
      fields.push('currency_code');
      values.push(settings.currency_code);
    }
    if (settings.tax_inclusive !== undefined && availableColumns.has('tax_inclusive')) {
      paramCount++;
      fields.push('tax_inclusive');
      values.push(settings.tax_inclusive);
    }
    if (settings.low_stock_threshold !== undefined && availableColumns.has('low_stock_threshold')) {
      paramCount++;
      fields.push('low_stock_threshold');
      values.push(settings.low_stock_threshold);
    }
    if (settings.theme !== undefined && availableColumns.has('theme')) {
      paramCount++;
      fields.push('theme');
      values.push(settings.theme);
    }
    // timezone belongs in stores table, not store_settings - removed
    if (settings.tax_rate !== undefined && availableColumns.has('tax_rate')) {
      paramCount++;
      fields.push('tax_rate');
      values.push(settings.tax_rate);
    }
    if (settings.receipt_footer !== undefined && availableColumns.has('receipt_footer')) {
      paramCount++;
      fields.push('receipt_footer');
      values.push(settings.receipt_footer);
    }
    if (settings.auto_backup !== undefined && availableColumns.has('auto_backup')) {
      paramCount++;
      fields.push('auto_backup');
      values.push(settings.auto_backup);
    }
    if (settings.backup_frequency !== undefined && availableColumns.has('backup_frequency')) {
      paramCount++;
      fields.push('backup_frequency');
      values.push(settings.backup_frequency);
    }
    // Optional columns
    if (settings.show_stock !== undefined && availableColumns.has('show_stock')) {
      paramCount++;
      fields.push('show_stock');
      values.push(settings.show_stock);
    }
    if (settings.auto_add_qty !== undefined && availableColumns.has('auto_add_qty')) {
      paramCount++;
      fields.push('auto_add_qty');
      values.push(settings.auto_add_qty);
    }
    if (settings.allow_negative !== undefined && availableColumns.has('allow_negative')) {
      paramCount++;
      fields.push('allow_negative');
      values.push(settings.allow_negative);
    }
    if (settings.paper_size !== undefined && availableColumns.has('paper_size')) {
      paramCount++;
      fields.push('paper_size');
      values.push(settings.paper_size);
    }
    if (settings.auto_print !== undefined && availableColumns.has('auto_print')) {
      paramCount++;
      fields.push('auto_print');
      values.push(settings.auto_print);
    }
    if (settings.receipt_header !== undefined && availableColumns.has('receipt_header')) {
      paramCount++;
      fields.push('receipt_header');
      values.push(settings.receipt_header);
    }

    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
    const query = `
      INSERT INTO store_settings (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    const result = await this.query<StoreSettings>(query, values);
    return result.rows[0];
  }

  static async update(storeId: string, settings: StoreSettingsInput): Promise<StoreSettings> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    const availableColumns = await this.getAvailableColumns();

    // Only add fields that exist in the database
    if (settings.currency_code !== undefined && availableColumns.has('currency_code')) {
      paramCount++;
      fields.push(`currency_code = $${paramCount}`);
      values.push(settings.currency_code);
    }
    if (settings.tax_inclusive !== undefined && availableColumns.has('tax_inclusive')) {
      paramCount++;
      fields.push(`tax_inclusive = $${paramCount}`);
      values.push(settings.tax_inclusive);
    }
    if (settings.low_stock_threshold !== undefined && availableColumns.has('low_stock_threshold')) {
      paramCount++;
      fields.push(`low_stock_threshold = $${paramCount}`);
      values.push(settings.low_stock_threshold);
    }
    if (settings.theme !== undefined && availableColumns.has('theme')) {
      paramCount++;
      fields.push(`theme = $${paramCount}`);
      values.push(settings.theme);
    }
    // timezone belongs in stores table, not store_settings - removed
    if (settings.tax_rate !== undefined && availableColumns.has('tax_rate')) {
      paramCount++;
      fields.push(`tax_rate = $${paramCount}`);
      values.push(settings.tax_rate);
    }
    if (settings.receipt_footer !== undefined && availableColumns.has('receipt_footer')) {
      paramCount++;
      fields.push(`receipt_footer = $${paramCount}`);
      values.push(settings.receipt_footer);
    }
    if (settings.auto_backup !== undefined && availableColumns.has('auto_backup')) {
      paramCount++;
      fields.push(`auto_backup = $${paramCount}`);
      values.push(settings.auto_backup);
    }
    if (settings.backup_frequency !== undefined && availableColumns.has('backup_frequency')) {
      paramCount++;
      fields.push(`backup_frequency = $${paramCount}`);
      values.push(settings.backup_frequency);
    }
    // Optional columns
    if (settings.show_stock !== undefined && availableColumns.has('show_stock')) {
      paramCount++;
      fields.push(`show_stock = $${paramCount}`);
      values.push(settings.show_stock);
    }
    if (settings.auto_add_qty !== undefined && availableColumns.has('auto_add_qty')) {
      paramCount++;
      fields.push(`auto_add_qty = $${paramCount}`);
      values.push(settings.auto_add_qty);
    }
    if (settings.allow_negative !== undefined && availableColumns.has('allow_negative')) {
      paramCount++;
      fields.push(`allow_negative = $${paramCount}`);
      values.push(settings.allow_negative);
    }
    if (settings.paper_size !== undefined && availableColumns.has('paper_size')) {
      paramCount++;
      fields.push(`paper_size = $${paramCount}`);
      values.push(settings.paper_size);
    }
    if (settings.auto_print !== undefined && availableColumns.has('auto_print')) {
      paramCount++;
      fields.push(`auto_print = $${paramCount}`);
      values.push(settings.auto_print);
    }
    if (settings.receipt_header !== undefined && availableColumns.has('receipt_header')) {
      paramCount++;
      fields.push(`receipt_header = $${paramCount}`);
      values.push(settings.receipt_header);
    }

    if (fields.length === 0) {
      // No fields to update, just return existing
      const existing = await this.findByStoreId(storeId);
      if (!existing) {
        throw new Error('Store settings not found');
      }
      return existing;
    }

    // Add updated_at
    fields.push('updated_at = CURRENT_TIMESTAMP');
    
    paramCount++;
    values.push(storeId);

    const query = `
      UPDATE store_settings
      SET ${fields.join(', ')}
      WHERE store_id = $${paramCount}
      RETURNING *
    `;
    const result = await this.query<StoreSettings>(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Store settings not found');
    }
    
    return result.rows[0];
  }

  static async createOrUpdate(storeId: string, settings: StoreSettingsInput): Promise<StoreSettings> {
    const existing = await this.findByStoreId(storeId);
    
    if (existing) {
      return this.update(storeId, settings);
    } else {
      return this.create(storeId, settings);
    }
  }

  static async delete(storeId: string): Promise<boolean> {
    const query = 'DELETE FROM store_settings WHERE store_id = $1';
    const result = await this.query(query, [storeId]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}

