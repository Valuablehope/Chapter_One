import { PoolClient } from 'pg';
import { BaseModel } from './BaseModel';
import { pool } from '../config/database';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';

export interface DisposeReason {
  reason_id: number;
  store_id: string | null;
  name: string;
  is_system: boolean;
  sort_order: number;
}

export interface DisposalItemInput {
  product_id: string;
  qty: number;
  reason_id: number;
  note?: string;
}

export interface DisposalItem {
  disposal_item_id: string;
  disposal_id: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  reason_id: number;
  reason_name?: string;
  qty: number;
  unit_cost: number;
  value_lost: number;
  note: string | null;
}

export interface Disposal {
  disposal_id: string;
  store_id: string;
  notes: string | null;
  total_qty: number;
  total_value_lost: number;
  disposed_by: string | null;
  disposed_by_name?: string;
  disposed_at: string;
  created_at: string;
  item_count?: number;
  items?: DisposalItem[];
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

export class DisposeModel extends BaseModel {
  // ── Reasons ────────────────────────────────────────────────────────────────

  static async getReasons(storeId: string): Promise<DisposeReason[]> {
    const result = await this.query<DisposeReason>(
      `SELECT reason_id, store_id, name, is_system, sort_order
       FROM dispose_reasons
       WHERE store_id IS NULL OR store_id = $1
       ORDER BY sort_order ASC, name ASC`,
      [storeId]
    );
    return result.rows;
  }

  static async createReason(storeId: string, name: string): Promise<DisposeReason> {
    const result = await this.query<DisposeReason>(
      `INSERT INTO dispose_reasons (store_id, name, is_system, sort_order)
       VALUES ($1, $2, false, 100)
       RETURNING *`,
      [storeId, name.trim()]
    );
    return result.rows[0];
  }

  static async deleteReason(reasonId: number, storeId: string): Promise<void> {
    const result = await this.query(
      `DELETE FROM dispose_reasons
       WHERE reason_id = $1 AND store_id = $2 AND is_system = false`,
      [reasonId, storeId]
    );
    if ((result.rowCount ?? 0) === 0) {
      throw new Error('Reason not found or cannot be deleted');
    }
  }

  // ── Disposals ──────────────────────────────────────────────────────────────

  /** Most recent received-PO unit cost for a product, or 0 if it was never purchased via a PO. */
  private static async getLastUnitCost(
    executor: Pick<PoolClient, 'query'>,
    productId: string
  ): Promise<number> {
    const r = await executor.query(
      `SELECT poi.unit_cost
       FROM purchase_order_items poi
       JOIN purchase_orders po ON po.po_id = poi.po_id
       WHERE poi.product_id = $1 AND po.status = 'RECEIVED'
       ORDER BY po.received_at DESC NULLS LAST, poi.created_at DESC
       LIMIT 1`,
      [productId]
    );
    return r.rows.length > 0 ? Number(r.rows[0].unit_cost) || 0 : 0;
  }

  static async createDisposal(
    storeId: string,
    userId: string,
    items: DisposalItemInput[],
    notes: string | null
  ): Promise<Disposal> {
    if (!items.length) {
      throw new Error('At least one item is required');
    }

    return await withRetry(
      async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
          await client.query('SET LOCAL statement_timeout = 30000');

          const disposalResult = await client.query<{ disposal_id: string }>(
            `INSERT INTO stock_disposals (store_id, notes, disposed_by)
             VALUES ($1, $2, $3)
             RETURNING disposal_id`,
            [storeId, notes?.trim() || null, userId]
          );
          const disposalId = disposalResult.rows[0].disposal_id;

          let totalQty = 0;
          let totalValue = 0;

          for (const item of items) {
            if (!(item.qty > 0)) {
              throw new Error('Each item qty must be a positive number');
            }

            const productRes = await client.query<{ track_inventory: boolean; name: string }>(
              `SELECT track_inventory, name FROM products WHERE product_id = $1`,
              [item.product_id]
            );
            if (productRes.rows.length === 0) {
              throw new Error('Product not found');
            }
            if (!productRes.rows[0].track_inventory) {
              throw new Error(`"${productRes.rows[0].name}" does not track inventory and cannot be disposed`);
            }

            // Lock the balance row for the duration of the transaction
            const balRes = await client.query<{ qty_on_hand: string }>(
              `SELECT qty_on_hand FROM stock_balances
               WHERE store_id = $1 AND product_id = $2 FOR UPDATE`,
              [storeId, item.product_id]
            );
            const currentBalance = balRes.rows.length > 0 ? Number(balRes.rows[0].qty_on_hand) : 0;
            if (item.qty > currentBalance) {
              throw new Error(
                `"${productRes.rows[0].name}": cannot dispose ${item.qty} — only ${currentBalance} in stock`
              );
            }

            const unitCost = await this.getLastUnitCost(client, item.product_id);
            const valueLost = round(unitCost * item.qty, 2);

            await client.query(
              `INSERT INTO stock_disposal_items (disposal_id, product_id, reason_id, qty, unit_cost, value_lost, note)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [disposalId, item.product_id, item.reason_id, item.qty, unitCost, valueLost, item.note?.trim() || null]
            );

            await client.query(
              `INSERT INTO stock_movements (store_id, product_id, reason, qty, reference, created_by)
               VALUES ($1, $2, 'disposed', $3, $4, $5)`,
              [storeId, item.product_id, -item.qty, disposalId, userId]
            );

            await client.query(
              `UPDATE stock_balances
               SET qty_on_hand = qty_on_hand - $3,
                   qty_out     = qty_out + $3,
                   updated_at  = NOW()
               WHERE store_id = $1 AND product_id = $2`,
              [storeId, item.product_id, item.qty]
            );

            totalQty += Number(item.qty);
            totalValue += valueLost;
          }

          await client.query(
            `UPDATE stock_disposals SET total_qty = $2, total_value_lost = $3 WHERE disposal_id = $1`,
            [disposalId, round(totalQty, 3), round(totalValue, 2)]
          );

          await client.query('COMMIT');
          logger.info(`Stock disposal created: id=${disposalId} store=${storeId} items=${items.length}`);
          return (await this.getDisposalById(disposalId, storeId)) as Disposal;
        } catch (error) {
          try {
            await client.query('ROLLBACK');
          } catch {
            /* ignore */
          }
          throw error;
        } finally {
          try {
            client.release();
          } catch {
            /* ignore */
          }
        }
      },
      { maxAttempts: 2, backoffMs: 200 }
    );
  }

  static async getDisposalById(disposalId: string, storeId: string): Promise<Disposal | null> {
    const headerRes = await this.query<any>(
      `SELECT d.*, u.full_name AS disposed_by_name
       FROM stock_disposals d
       LEFT JOIN app_users u ON u.user_id = d.disposed_by
       WHERE d.disposal_id = $1 AND d.store_id = $2`,
      [disposalId, storeId]
    );
    if (headerRes.rows.length === 0) return null;

    const itemsRes = await this.query<any>(
      `SELECT di.*, p.name AS product_name, p.sku, r.name AS reason_name
       FROM stock_disposal_items di
       JOIN products p ON p.product_id = di.product_id
       JOIN dispose_reasons r ON r.reason_id = di.reason_id
       WHERE di.disposal_id = $1
       ORDER BY di.created_at ASC`,
      [disposalId]
    );

    return { ...headerRes.rows[0], items: itemsRes.rows };
  }

  static async listDisposals(
    storeId: string,
    page = 1,
    limit = 20,
    date?: string
  ): Promise<{ data: Disposal[]; total: number }> {
    const offset = (page - 1) * limit;
    const params: any[] = [storeId];
    let filter = '';
    if (date) {
      params.push(date);
      filter = `AND (d.disposed_at AT TIME ZONE 'UTC')::date = $${params.length}`;
    }

    const countResult = await this.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM stock_disposals d WHERE d.store_id = $1 ${filter}`,
      params
    );

    params.push(limit, offset);
    const result = await this.query<any>(
      `SELECT d.*, u.full_name AS disposed_by_name,
              COALESCE(ic.item_count, 0)::int AS item_count
       FROM stock_disposals d
       LEFT JOIN app_users u ON u.user_id = d.disposed_by
       LEFT JOIN (
         SELECT disposal_id, COUNT(*) AS item_count
         FROM stock_disposal_items
         GROUP BY disposal_id
       ) ic ON ic.disposal_id = d.disposal_id
       WHERE d.store_id = $1 ${filter}
       ORDER BY d.disposed_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return { data: result.rows, total: Number(countResult.rows[0].count) };
  }

  static async deleteDisposal(disposalId: string, storeId: string): Promise<void> {
    return await withRetry(
      async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const headerRes = await client.query<{ disposal_id: string }>(
            `SELECT disposal_id FROM stock_disposals WHERE disposal_id = $1 AND store_id = $2 FOR UPDATE`,
            [disposalId, storeId]
          );
          if (headerRes.rows.length === 0) {
            throw new Error('Disposal not found');
          }

          const itemsRes = await client.query<{ product_id: string; qty: string }>(
            `SELECT product_id, qty FROM stock_disposal_items WHERE disposal_id = $1`,
            [disposalId]
          );

          for (const item of itemsRes.rows) {
            await client.query(
              `SELECT qty_on_hand FROM stock_balances WHERE store_id = $1 AND product_id = $2 FOR UPDATE`,
              [storeId, item.product_id]
            );
            await client.query(
              `UPDATE stock_balances
               SET qty_on_hand = qty_on_hand + $3,
                   qty_out     = GREATEST(0, qty_out - $3),
                   updated_at  = NOW()
               WHERE store_id = $1 AND product_id = $2`,
              [storeId, item.product_id, item.qty]
            );
          }

          await client.query(
            `DELETE FROM stock_movements WHERE store_id = $1 AND reason = 'disposed' AND reference = $2`,
            [storeId, disposalId]
          );

          // Cascades to stock_disposal_items
          await client.query(`DELETE FROM stock_disposals WHERE disposal_id = $1`, [disposalId]);

          await client.query('COMMIT');
          logger.info(`Stock disposal reversed and deleted: id=${disposalId} store=${storeId}`);
        } catch (error) {
          try {
            await client.query('ROLLBACK');
          } catch {
            /* ignore */
          }
          throw error;
        } finally {
          try {
            client.release();
          } catch {
            /* ignore */
          }
        }
      },
      { maxAttempts: 2, backoffMs: 200 }
    );
  }
}
