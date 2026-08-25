import crypto from 'crypto';
import { BaseModel, PaginatedResult } from './BaseModel';

export interface Terminal {
  terminal_id: string;
  store_id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
  hostname: string | null;
  ip_address: string | null;
  app_version: string | null;
  is_online: boolean;
}

const ONLINE_WINDOW_SECONDS = 90;
const PAIRING_CODE_TTL_MINUTES = 15;

const SELECT_COLUMNS = `
  terminal_id, store_id, code, name, is_active, created_at, updated_at,
  last_seen_at, hostname, ip_address, app_version,
  (last_seen_at IS NOT NULL AND last_seen_at > now() - interval '${ONLINE_WINDOW_SECONDS} seconds') AS is_online
`;

export function hashPairingCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export interface TerminalFilters {
  store_id?: string;
  search?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export class TerminalModel extends BaseModel {
  static async findAll(filters: TerminalFilters = {}): Promise<PaginatedResult<Terminal>> {
    const { page, limit, offset } = this.getPaginationParams(filters.page, filters.limit);

    let query = `SELECT ${SELECT_COLUMNS} FROM terminals WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (filters.store_id) {
      paramCount++;
      query += ` AND store_id = $${paramCount}`;
      params.push(filters.store_id);
    }

    if (filters.search) {
      paramCount++;
      query += ` AND (
        name ILIKE $${paramCount} OR
        code ILIKE $${paramCount}
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

    const result = await this.query<Terminal>(query, params);
    return this.buildPaginatedResult(result.rows, total, page, limit);
  }

  static async findById(terminalId: string): Promise<Terminal | null> {
    const query = `SELECT ${SELECT_COLUMNS} FROM terminals WHERE terminal_id = $1`;
    const result = await this.query<Terminal>(query, [terminalId]);
    return result.rows[0] || null;
  }

  /** Generates a one-time, expiring pairing code for a terminal. Returns the raw code (shown once). */
  static async generatePairingCode(terminalId: string): Promise<{ code: string; expiresAt: string }> {
    const code = crypto.randomBytes(5).toString('hex').slice(0, 8).toUpperCase();
    const query = `
      UPDATE terminals
      SET pairing_code_hash = $1,
          pairing_code_expires_at = now() + interval '${PAIRING_CODE_TTL_MINUTES} minutes',
          updated_at = CURRENT_TIMESTAMP
      WHERE terminal_id = $2
      RETURNING pairing_code_expires_at
    `;
    const result = await this.query<{ pairing_code_expires_at: string }>(query, [hashPairingCode(code), terminalId]);
    if (result.rows.length === 0) {
      throw new Error('Terminal not found');
    }
    return { code, expiresAt: result.rows[0].pairing_code_expires_at };
  }

  static async create(terminal: Partial<Terminal>): Promise<Terminal> {
    const query = `
      INSERT INTO terminals (store_id, code, name, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [
      terminal.store_id,
      terminal.code,
      terminal.name,
      terminal.is_active !== undefined ? terminal.is_active : true,
    ];
    const result = await this.query<Terminal>(query, values);
    return result.rows[0];
  }

  static async update(terminalId: string, updates: Partial<Terminal>): Promise<Terminal> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

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
    if (updates.store_id !== undefined) {
      paramCount++;
      fields.push(`store_id = $${paramCount}`);
      values.push(updates.store_id);
    }
    if (updates.is_active !== undefined) {
      paramCount++;
      fields.push(`is_active = $${paramCount}`);
      values.push(updates.is_active);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    paramCount++;
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    paramCount++;
    values.push(terminalId);

    const query = `
      UPDATE terminals
      SET ${fields.join(', ')}
      WHERE terminal_id = $${paramCount}
      RETURNING *
    `;
    const result = await this.query<Terminal>(query, values);
    return result.rows[0];
  }

  static async delete(terminalId: string): Promise<boolean> {
    const query = 'DELETE FROM terminals WHERE terminal_id = $1';
    const result = await this.query(query, [terminalId]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}









