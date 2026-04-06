import type { PoolClient } from 'pg';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { SaleModel } from './SaleModel';

export interface DayClosurePreview {
  store_id: string;
  store_name: string | null;
  total_sales: number;
  total_transactions: number;
  cash_expected: number;
  card_total: number;
  other_payments: number;
  voucher_total: number;
}

export interface DayClosureRecord {
  id: number;
  store_id: string;
  closure_date: string;
  total_sales: number;
  total_transactions: number;
  cash_expected: number;
  cash_actual: number | null;
  cash_difference: number | null;
  card_total: number;
  other_payments: number;
  closed_by: string;
  closed_at: string;
  z_number: number;
  notes: string | null;
  created_at: string;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

async function computePreview(
  executor: Pick<PoolClient, 'query'>,
  storeId: string
): Promise<Omit<DayClosurePreview, 'store_id' | 'store_name'>> {
  const saleAgg = await executor.query(
    `
      SELECT
        COALESCE(COUNT(*)::int, 0) AS total_transactions,
        COALESCE(SUM(s.grand_total), 0)::numeric AS total_sales
      FROM sales s
      WHERE s.store_id = $1
        AND s.status = 'paid'
        AND (s.day_closure_id IS NULL)
    `,
    [storeId]
  );

  const payAgg = await executor.query(
    `
      SELECT
        COALESCE(SUM(CASE WHEN sp.method = 'cash' THEN sp.amount::numeric ELSE 0 END), 0) AS cash_expected,
        COALESCE(SUM(CASE WHEN sp.method = 'card' THEN sp.amount::numeric ELSE 0 END), 0) AS card_total,
        COALESCE(SUM(CASE WHEN sp.method = 'voucher' THEN sp.amount::numeric ELSE 0 END), 0) AS voucher_total,
        COALESCE(SUM(CASE WHEN sp.method = 'other' THEN sp.amount::numeric ELSE 0 END), 0) AS other_only
      FROM sale_payments sp
      INNER JOIN sales s ON s.sale_id = sp.sale_id
      WHERE s.store_id = $1
        AND s.status = 'paid'
        AND (s.day_closure_id IS NULL)
    `,
    [storeId]
  );

  const sr = saleAgg.rows[0];
  const pr = payAgg.rows[0];
  const voucher_total = roundMoney(Number(pr.voucher_total));
  const other_only = roundMoney(Number(pr.other_only));
  const other_payments = roundMoney(voucher_total + other_only);

  return {
    total_transactions: Number(sr.total_transactions) || 0,
    total_sales: roundMoney(Number(sr.total_sales)),
    cash_expected: roundMoney(Number(pr.cash_expected)),
    card_total: roundMoney(Number(pr.card_total)),
    other_payments,
    voucher_total,
  };
}

export class DayClosureModel {
  static async resolveStoreId(explicitStoreId?: string | null): Promise<string> {
    if (explicitStoreId?.trim()) {
      const r = await pool.query('SELECT store_id FROM stores WHERE store_id = $1 AND is_active = true', [
        explicitStoreId.trim(),
      ]);
      if (r.rows.length === 0) {
        throw new Error('Store not found or inactive');
      }
      return r.rows[0].store_id;
    }
    const def = await SaleModel.getDefaultStore();
    if (!def) {
      throw new Error('No active store configured');
    }
    return def.store_id;
  }

  static async preview(storeId: string): Promise<DayClosurePreview> {
    const storeNameResult = await pool.query('SELECT name FROM stores WHERE store_id = $1', [storeId]);
    const store_name = storeNameResult.rows[0]?.name ?? null;

    const data = await computePreview(pool, storeId);
    return { store_id: storeId, store_name, ...data };
  }

  static async close(
    storeId: string,
    closedByUserId: string,
    cashActual: number,
    notes: string | null
  ): Promise<DayClosureRecord> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text)::bigint)', [storeId]);

      const preview = await computePreview(client, storeId);
      if (preview.total_transactions === 0) {
        await client.query('ROLLBACK');
        throw new Error('No unclosed sales to include in this closure');
      }

      const cash_expected = preview.cash_expected;
      const cash_difference = roundMoney(cashActual - cash_expected);

      const zRes = await client.query(
        `SELECT COALESCE(MAX(z_number), 0)::int AS m FROM day_closures WHERE store_id = $1`,
        [storeId]
      );
      const z_number = Number(zRes.rows[0].m) + 1;

      const insert = await client.query(
        `
        INSERT INTO day_closures (
          store_id,
          closure_date,
          total_sales,
          total_transactions,
          cash_expected,
          cash_actual,
          cash_difference,
          card_total,
          other_payments,
          closed_by,
          z_number,
          notes
        )
        VALUES (
          $1,
          (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11
        )
        RETURNING *
      `,
        [
          storeId,
          preview.total_sales,
          preview.total_transactions,
          cash_expected,
          cashActual,
          cash_difference,
          preview.card_total,
          preview.other_payments,
          closedByUserId,
          z_number,
          notes?.trim() || null,
        ]
      );

      const row = insert.rows[0] as DayClosureRecord;

      const upd = await client.query(
        `
        UPDATE sales
        SET day_closure_id = $1
        WHERE store_id = $2
          AND status = 'paid'
          AND day_closure_id IS NULL
      `,
        [row.id, storeId]
      );

      const updated = upd.rowCount ?? 0;
      if (updated !== preview.total_transactions) {
        logger.warn(
          `[DayClosure] Updated ${updated} sales but preview counted ${preview.total_transactions}`
        );
      }

      await client.query('COMMIT');
      return row;
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw e;
    } finally {
      client.release();
    }
  }

  static async findById(id: number): Promise<DayClosureRecord | null> {
    const r = await pool.query(`SELECT * FROM day_closures WHERE id = $1`, [id]);
    return (r.rows[0] as DayClosureRecord) || null;
  }
}
