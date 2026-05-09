import { BaseModel } from './BaseModel';
import { pool } from '../config/database';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';

export interface OpeningStockItem {
  item_id: string;
  session_id: string;
  product_id: string;
  qty: number;
  product_name?: string;
  sku?: string;
  barcode?: string;
}

export interface OpeningStockSession {
  session_id: string;
  store_id: string;
  reference: string;
  notes?: string;
  status: 'draft' | 'committed';
  committed_at?: string;
  committed_by?: string;
  created_at: string;
  created_by?: string;
  items: OpeningStockItem[];
}

export interface SaveOpeningStockData {
  store_id: string;
  notes?: string;
  items: { product_id: string; qty: number }[];
  created_by?: string;
}

export class OpeningStockModel extends BaseModel {
  static async getDefaultStore(): Promise<{ store_id: string } | null> {
    const result = await this.query<{ store_id: string }>(
      `SELECT store_id FROM stores WHERE is_active = true ORDER BY created_at ASC LIMIT 1`
    );
    return result.rows[0] || null;
  }

  static async getSession(storeId: string): Promise<OpeningStockSession | null> {
    const result = await this.query<any>(
      `SELECT s.*,
        COALESCE(
          json_agg(
            json_build_object(
              'item_id',      i.item_id,
              'session_id',   i.session_id,
              'product_id',   i.product_id,
              'qty',          i.qty,
              'product_name', p.name,
              'sku',          p.sku,
              'barcode',      p.barcode
            ) ORDER BY p.name
          ) FILTER (WHERE i.item_id IS NOT NULL),
          '[]'
        ) AS items
       FROM opening_stock_sessions s
       LEFT JOIN opening_stock_items i ON i.session_id = s.session_id
       LEFT JOIN products p ON p.product_id = i.product_id
       WHERE s.store_id = $1
       GROUP BY s.session_id`,
      [storeId]
    );
    return result.rows[0] || null;
  }

  static async saveSession(data: SaveOpeningStockData): Promise<OpeningStockSession> {
    return await withRetry(
      async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SET LOCAL statement_timeout = 30000');

          const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const reference = `OPENING-${today}`;

          // Upsert session — only allowed while still in draft status
          const sessionResult = await client.query<any>(
            `INSERT INTO opening_stock_sessions (store_id, reference, notes, status, created_by)
             VALUES ($1, $2, $3, 'draft', $4)
             ON CONFLICT (store_id) DO UPDATE
               SET notes     = EXCLUDED.notes,
                   reference = opening_stock_sessions.reference
             WHERE opening_stock_sessions.status = 'draft'
             RETURNING *`,
            [data.store_id, reference, data.notes ?? null, data.created_by ?? null]
          );

          if (sessionResult.rows.length === 0) {
            throw new Error('Opening stock has already been committed and cannot be modified');
          }

          const session = sessionResult.rows[0];

          // Replace items in bulk
          await client.query(
            `DELETE FROM opening_stock_items WHERE session_id = $1`,
            [session.session_id]
          );

          for (const item of data.items) {
            await client.query(
              `INSERT INTO opening_stock_items (session_id, product_id, qty)
               VALUES ($1, $2, $3)`,
              [session.session_id, item.product_id, item.qty]
            );
          }

          await client.query('COMMIT');
          return (await this.getSession(data.store_id)) as OpeningStockSession;
        } catch (error) {
          try { await client.query('ROLLBACK'); } catch { /* ignore */ }
          throw error;
        } finally {
          try { client.release(); } catch { /* ignore */ }
        }
      },
      { maxAttempts: 3, backoffMs: 150 }
    );
  }

  static async commitSession(
    sessionId: string,
    storeId: string,
    userId: string
  ): Promise<OpeningStockSession> {
    return await withRetry(
      async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SET LOCAL statement_timeout = 60000');
          await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

          // Lock and verify session
          const sessionResult = await client.query<any>(
            `SELECT * FROM opening_stock_sessions
             WHERE session_id = $1 AND store_id = $2 AND status = 'draft'
             FOR UPDATE`,
            [sessionId, storeId]
          );

          if (sessionResult.rows.length === 0) {
            throw new Error('Session not found or already committed');
          }

          const session = sessionResult.rows[0];

          // Load items with inventory flag
          const itemsResult = await client.query<any>(
            `SELECT i.*, p.track_inventory
             FROM opening_stock_items i
             JOIN products p ON p.product_id = i.product_id
             WHERE i.session_id = $1`,
            [sessionId]
          );

          if (itemsResult.rows.length === 0) {
            throw new Error('No items to commit — add at least one product quantity');
          }

          for (const item of itemsResult.rows) {
            if (!item.track_inventory) continue;

            // Row-level lock on stock balance
            await client.query(
              `SELECT qty_on_hand FROM stock_balances
               WHERE store_id = $1 AND product_id = $2 FOR UPDATE`,
              [storeId, item.product_id]
            );

            // Stock movement
            await client.query(
              `INSERT INTO stock_movements (store_id, product_id, reason, qty, reference, created_by)
               VALUES ($1, $2, 'opening_stock', $3, $4, $5)`,
              [storeId, item.product_id, item.qty, session.reference, userId]
            );

            // Update materialized balance
            await client.query(
              `INSERT INTO stock_balances (store_id, product_id, qty_on_hand, qty_in)
               VALUES ($1, $2, $3, $3)
               ON CONFLICT (store_id, product_id)
               DO UPDATE SET
                 qty_on_hand = stock_balances.qty_on_hand + $3,
                 qty_in      = stock_balances.qty_in      + $3,
                 updated_at  = NOW()`,
              [storeId, item.product_id, item.qty]
            );
          }

          // Mark committed
          await client.query(
            `UPDATE opening_stock_sessions
             SET status = 'committed', committed_at = NOW(), committed_by = $2
             WHERE session_id = $1`,
            [sessionId, userId]
          );

          await client.query('COMMIT');
          logger.info(`Opening stock committed: session=${sessionId} store=${storeId}`);
          return (await this.getSession(storeId)) as OpeningStockSession;
        } catch (error) {
          try { await client.query('ROLLBACK'); } catch { /* ignore */ }
          throw error;
        } finally {
          try { client.release(); } catch { /* ignore */ }
        }
      },
      { maxAttempts: 2, backoffMs: 200 }
    );
  }

  static async deleteSession(sessionId: string, storeId: string): Promise<void> {
    return await withRetry(
      async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const sessionResult = await client.query<any>(
            `SELECT * FROM opening_stock_sessions
             WHERE session_id = $1 AND store_id = $2 FOR UPDATE`,
            [sessionId, storeId]
          );

          if (sessionResult.rows.length === 0) {
            throw new Error('Session not found');
          }

          const session = sessionResult.rows[0];

          if (session.status === 'committed') {
            // Reverse each movement created during the commit
            const itemsResult = await client.query<any>(
              `SELECT i.*, p.track_inventory
               FROM opening_stock_items i
               JOIN products p ON p.product_id = i.product_id
               WHERE i.session_id = $1`,
              [sessionId]
            );

            for (const item of itemsResult.rows) {
              if (!item.track_inventory) continue;

              await client.query(
                `DELETE FROM stock_movements
                 WHERE store_id = $1 AND product_id = $2
                   AND reason = 'opening_stock' AND reference = $3`,
                [storeId, item.product_id, session.reference]
              );

              await client.query(
                `UPDATE stock_balances
                 SET qty_on_hand = GREATEST(0, qty_on_hand - $1),
                     qty_in      = GREATEST(0, qty_in      - $1),
                     updated_at  = NOW()
                 WHERE store_id = $2 AND product_id = $3`,
                [item.qty, storeId, item.product_id]
              );
            }
          }

          // Cascade deletes items via FK
          await client.query(
            `DELETE FROM opening_stock_sessions WHERE session_id = $1`,
            [sessionId]
          );

          await client.query('COMMIT');
          logger.info(`Opening stock reset: session=${sessionId} store=${storeId}`);
        } catch (error) {
          try { await client.query('ROLLBACK'); } catch { /* ignore */ }
          throw error;
        } finally {
          try { client.release(); } catch { /* ignore */ }
        }
      },
      { maxAttempts: 2, backoffMs: 200 }
    );
  }
}
