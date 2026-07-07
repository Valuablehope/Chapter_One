import { BaseModel } from './BaseModel';

export interface ScaleDevice {
  scale_id: string;
  name: string;
  brand: string;
  driver: 'generic_tcp' | 'csv_export';
  host?: string | null;
  port?: number | null;
  department?: number | null;
  options: Record<string, any>;
  is_active: boolean;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  last_sync_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScaleBarcodeFormat {
  format_id: string;
  name: string;
  prefixes: string;
  plu_length: number;
  value_length: number;
  value_type: 'price' | 'weight' | 'quantity' | 'none';
  value_divisor: number;
  check_digit: 'none' | 'ean13';
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface ScalePluProduct {
  product_id: string;
  plu_code: number;
  name: string;
  sale_price: number;
  list_price: number;
  unit_of_measure: string;
  tax_rate: number;
}

export class ScaleModel extends BaseModel {
  // ---------- Devices ----------

  static async listDevices(): Promise<ScaleDevice[]> {
    const result = await this.query<ScaleDevice>(
      'SELECT * FROM scale_devices ORDER BY created_at ASC'
    );
    return result.rows;
  }

  static async getDevice(scaleId: string): Promise<ScaleDevice | null> {
    const result = await this.query<ScaleDevice>(
      'SELECT * FROM scale_devices WHERE scale_id = $1',
      [scaleId]
    );
    return result.rows[0] || null;
  }

  static async createDevice(data: {
    name: string;
    brand?: string;
    driver?: string;
    host?: string | null;
    port?: number | null;
    department?: number | null;
    options?: Record<string, any>;
    is_active?: boolean;
  }): Promise<ScaleDevice> {
    const result = await this.query<ScaleDevice>(
      `INSERT INTO scale_devices (name, brand, driver, host, port, department, options, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.name,
        data.brand || 'generic',
        data.driver || 'generic_tcp',
        data.host ?? null,
        data.port ?? null,
        data.department ?? null,
        JSON.stringify(data.options || {}),
        data.is_active ?? true,
      ]
    );
    return result.rows[0];
  }

  static async updateDevice(
    scaleId: string,
    updates: Partial<Omit<ScaleDevice, 'scale_id' | 'created_at' | 'updated_at'>>
  ): Promise<ScaleDevice | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 0;

    const push = (col: string, val: any) => {
      i += 1;
      fields.push(`${col} = $${i}`);
      values.push(val);
    };

    if (updates.name !== undefined) push('name', updates.name);
    if (updates.brand !== undefined) push('brand', updates.brand);
    if (updates.driver !== undefined) push('driver', updates.driver);
    if (updates.host !== undefined) push('host', updates.host);
    if (updates.port !== undefined) push('port', updates.port);
    if (updates.department !== undefined) push('department', updates.department);
    if (updates.options !== undefined) push('options', JSON.stringify(updates.options));
    if (updates.is_active !== undefined) push('is_active', updates.is_active);

    if (fields.length === 0) return this.getDevice(scaleId);

    push('updated_at', new Date());
    values.push(scaleId);

    const result = await this.query<ScaleDevice>(
      `UPDATE scale_devices SET ${fields.join(', ')} WHERE scale_id = $${i + 1} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  static async deleteDevice(scaleId: string): Promise<boolean> {
    const result = await this.query('DELETE FROM scale_devices WHERE scale_id = $1', [scaleId]);
    return (result.rowCount ?? 0) > 0;
  }

  static async recordSyncResult(
    scaleId: string,
    status: 'success' | 'error',
    message: string
  ): Promise<void> {
    await this.query(
      `UPDATE scale_devices
       SET last_sync_at = NOW(), last_sync_status = $2, last_sync_message = $3, updated_at = NOW()
       WHERE scale_id = $1`,
      [scaleId, status, message]
    );
  }

  // ---------- Barcode formats ----------

  static async listFormats(activeOnly = false): Promise<ScaleBarcodeFormat[]> {
    const result = await this.query<ScaleBarcodeFormat>(
      `SELECT * FROM scale_barcode_formats
       ${activeOnly ? 'WHERE is_active = true' : ''}
       ORDER BY priority ASC, created_at ASC`
    );
    return result.rows;
  }

  static async createFormat(data: {
    name: string;
    prefixes: string;
    plu_length: number;
    value_length: number;
    value_type: string;
    value_divisor: number;
    check_digit: string;
    is_active?: boolean;
    priority?: number;
  }): Promise<ScaleBarcodeFormat> {
    const result = await this.query<ScaleBarcodeFormat>(
      `INSERT INTO scale_barcode_formats
         (name, prefixes, plu_length, value_length, value_type, value_divisor, check_digit, is_active, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.name,
        data.prefixes,
        data.plu_length,
        data.value_length,
        data.value_type,
        data.value_divisor,
        data.check_digit,
        data.is_active ?? true,
        data.priority ?? 0,
      ]
    );
    return result.rows[0];
  }

  static async updateFormat(
    formatId: string,
    updates: Partial<Omit<ScaleBarcodeFormat, 'format_id' | 'created_at' | 'updated_at'>>
  ): Promise<ScaleBarcodeFormat | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 0;

    const push = (col: string, val: any) => {
      i += 1;
      fields.push(`${col} = $${i}`);
      values.push(val);
    };

    if (updates.name !== undefined) push('name', updates.name);
    if (updates.prefixes !== undefined) push('prefixes', updates.prefixes);
    if (updates.plu_length !== undefined) push('plu_length', updates.plu_length);
    if (updates.value_length !== undefined) push('value_length', updates.value_length);
    if (updates.value_type !== undefined) push('value_type', updates.value_type);
    if (updates.value_divisor !== undefined) push('value_divisor', updates.value_divisor);
    if (updates.check_digit !== undefined) push('check_digit', updates.check_digit);
    if (updates.is_active !== undefined) push('is_active', updates.is_active);
    if (updates.priority !== undefined) push('priority', updates.priority);

    if (fields.length === 0) {
      const result = await this.query<ScaleBarcodeFormat>(
        'SELECT * FROM scale_barcode_formats WHERE format_id = $1',
        [formatId]
      );
      return result.rows[0] || null;
    }

    push('updated_at', new Date());
    values.push(formatId);

    const result = await this.query<ScaleBarcodeFormat>(
      `UPDATE scale_barcode_formats SET ${fields.join(', ')} WHERE format_id = $${i + 1} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  static async deleteFormat(formatId: string): Promise<boolean> {
    const result = await this.query('DELETE FROM scale_barcode_formats WHERE format_id = $1', [
      formatId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  // ---------- PLU products ----------

  static async listPluProducts(): Promise<ScalePluProduct[]> {
    const result = await this.query<ScalePluProduct>(
      `SELECT product_id, plu_code, name, sale_price, list_price, unit_of_measure, tax_rate
       FROM products
       WHERE plu_code IS NOT NULL
       ORDER BY plu_code ASC`
    );
    return result.rows;
  }

  static async checkPluUnique(pluCode: number, excludeProductId?: string): Promise<boolean> {
    let query = 'SELECT COUNT(*) FROM products WHERE plu_code = $1';
    const params: any[] = [pluCode];
    if (excludeProductId) {
      query += ' AND product_id != $2';
      params.push(excludeProductId);
    }
    const result = await this.query<{ count: string }>(query, params);
    return parseInt(result.rows[0].count, 10) === 0;
  }
}
