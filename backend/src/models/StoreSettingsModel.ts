import { BaseModel } from './BaseModel';

export type PosModuleType = 'store' | 'retail_store' | 'restaurant';

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
  pos_module_type?: PosModuleType;
  restaurant_table_count?: number | null;
  restaurant_track_guests_per_table?: boolean;
  lbp_exchange_rate?: number | null;
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
  pos_module_type?: PosModuleType;
  restaurant_table_count?: number | null;
  restaurant_track_guests_per_table?: boolean;
  lbp_exchange_rate?: number | null;
}

interface StoreSettingsSchemaAudit {
  ok: boolean;
  schema: string;
  missingColumns: string[];
  invalidTypes: Array<{
    column: string;
    expected: string[];
    actual: string;
  }>;
}

export class StoreSettingsModel extends BaseModel {
  // Cache for available columns
  private static availableColumns: Set<string> | null = null;
  private static availableColumnTypes: Map<string, string> | null = null;
  private static columnsCheckPromise: Promise<Set<string>> | null = null;
  private static readonly requiredRestaurantColumns: Record<string, string[]> = {
    pos_module_type: ['text', 'character varying'],
    restaurant_table_count: ['integer', 'bigint', 'smallint'],
    restaurant_track_guests_per_table: ['boolean'],
  };

  private static hasRestaurantPayload(settings: StoreSettingsInput): boolean {
    return (
      settings.pos_module_type !== undefined ||
      settings.restaurant_table_count !== undefined ||
      settings.restaurant_track_guests_per_table !== undefined
    );
  }

  // Get available columns from store_settings table
  private static async getAvailableColumns(): Promise<Set<string>> {
    // Return cached result immediately if available
    if (this.availableColumns !== null) {
      return this.availableColumns;
    }

    // If a check is already in progress, wait for it instead of starting a new one
    if (this.columnsCheckPromise) {
      return this.columnsCheckPromise;
    }

    // Start new check
    this.columnsCheckPromise = (async () => {
      try {
        const query = `
          SELECT column_name, data_type
          FROM information_schema.columns 
          WHERE table_name = 'store_settings'
            AND table_schema = current_schema()
        `;
        const result = await this.query<{ column_name: string; data_type: string }>(query);
        this.availableColumns = new Set(result.rows.map((row: { column_name: string }) => row.column_name));
        this.availableColumnTypes = new Map(
          result.rows.map((row: { column_name: string; data_type: string }) => [row.column_name, row.data_type])
        );
        this.columnsCheckPromise = null; // Clear promise after completion
        return this.availableColumns;
      } catch (error) {
        this.columnsCheckPromise = null; // Clear promise on error
        console.warn('Could not fetch store_settings columns, using defaults', error);
        this.availableColumns = new Set();
        this.availableColumnTypes = new Map();
        return this.availableColumns;
      }
    })();

    return this.columnsCheckPromise;
  }

  static async auditRestaurantSchema(): Promise<StoreSettingsSchemaAudit> {
    const availableColumns = await this.getAvailableColumns();
    const schemaResult = await this.query<{ schema_name: string }>('SELECT current_schema() AS schema_name');
    const schema = schemaResult.rows[0]?.schema_name || 'public';

    const missingColumns: string[] = [];
    const invalidTypes: Array<{
      column: string;
      expected: string[];
      actual: string;
    }> = [];

    for (const [column, expectedTypes] of Object.entries(this.requiredRestaurantColumns)) {
      if (!availableColumns.has(column)) {
        missingColumns.push(column);
        continue;
      }

      const actualType = this.availableColumnTypes?.get(column);
      if (actualType && !expectedTypes.includes(actualType)) {
        invalidTypes.push({
          column,
          expected: expectedTypes,
          actual: actualType,
        });
      }
    }

    return {
      ok: missingColumns.length === 0 && invalidTypes.length === 0,
      schema,
      missingColumns,
      invalidTypes,
    };
  }

  private static async ensureRestaurantSchemaCompatible(settings: StoreSettingsInput): Promise<void> {
    if (!this.hasRestaurantPayload(settings)) {
      return;
    }

    const audit = await this.auditRestaurantSchema();
    if (audit.ok) {
      return;
    }

    const typeIssues =
      audit.invalidTypes.length > 0
        ? ` Invalid types: ${audit.invalidTypes
            .map(issue => `${issue.column}=${issue.actual} (expected ${issue.expected.join('/')})`)
            .join(', ')}.`
        : '';

    throw new Error(
      `store_settings schema mismatch for restaurant fields in schema "${audit.schema}".` +
        (audit.missingColumns.length > 0 ? ` Missing columns: ${audit.missingColumns.join(', ')}.` : '') +
        typeIssues +
        ' Apply database/migrations/008_ensure_public_store_settings_restaurant_columns.sql (or equivalent) and retry.'
    );
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
    await this.ensureRestaurantSchemaCompatible(settings);

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
    if (settings.pos_module_type !== undefined && availableColumns.has('pos_module_type')) {
      paramCount++;
      fields.push('pos_module_type');
      values.push(settings.pos_module_type);
    }
    if (settings.restaurant_table_count !== undefined && availableColumns.has('restaurant_table_count')) {
      paramCount++;
      fields.push('restaurant_table_count');
      values.push(settings.restaurant_table_count);
    }
    if (settings.restaurant_track_guests_per_table !== undefined && availableColumns.has('restaurant_track_guests_per_table')) {
      paramCount++;
      fields.push('restaurant_track_guests_per_table');
      values.push(settings.restaurant_track_guests_per_table);
    }
    if (settings.lbp_exchange_rate !== undefined && availableColumns.has('lbp_exchange_rate')) {
      paramCount++;
      fields.push('lbp_exchange_rate');
      values.push(settings.lbp_exchange_rate);
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
    await this.ensureRestaurantSchemaCompatible(settings);

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
    if (settings.pos_module_type !== undefined && availableColumns.has('pos_module_type')) {
      paramCount++;
      fields.push(`pos_module_type = $${paramCount}`);
      values.push(settings.pos_module_type);
    }
    if (settings.restaurant_table_count !== undefined && availableColumns.has('restaurant_table_count')) {
      paramCount++;
      fields.push(`restaurant_table_count = $${paramCount}`);
      values.push(settings.restaurant_table_count);
    }
    if (settings.restaurant_track_guests_per_table !== undefined && availableColumns.has('restaurant_track_guests_per_table')) {
      paramCount++;
      fields.push(`restaurant_track_guests_per_table = $${paramCount}`);
      values.push(settings.restaurant_track_guests_per_table);
    }
    if (settings.lbp_exchange_rate !== undefined && availableColumns.has('lbp_exchange_rate')) {
      paramCount++;
      fields.push(`lbp_exchange_rate = $${paramCount}`);
      values.push(settings.lbp_exchange_rate);
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
      try {
        return await this.update(storeId, settings);
      } catch (err) {
        if (err instanceof Error && err.message === 'Store settings not found') {
          return this.create(storeId, settings);
        }
        throw err;
      }
    }

    return this.create(storeId, settings);
  }

  static async delete(storeId: string): Promise<boolean> {
    const query = 'DELETE FROM store_settings WHERE store_id = $1';
    const result = await this.query(query, [storeId]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}

