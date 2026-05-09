import type { PoolClient } from 'pg';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { SaleModel } from './SaleModel';
import { ExpensesModel } from './ExpensesModel';

export interface DayClosureStats {
  total_sales: number;        // revenues counted in drawer (may exclude delivery)
  total_transactions: number;
  cash_expected: number;
  card_total: number;
  other_payments: number;
  voucher_total: number;
  total_expenses: number;
  delivery_total: number;           // sum of all delivery charges in the period
  include_delivery_in_drawer: boolean;
}

export interface DayClosurePreview extends DayClosureStats {
  store_id: string;
  store_name: string | null;
  currency_code: string;
  lbp_exchange_rate: number | null;
  round_lbp_to_1000?: boolean;
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
  cash_breakdown: any | null;
  total_expenses: number;
  created_at: string;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

async function computePreview(
  executor: Pick<PoolClient, 'query'>,
  storeId: string
): Promise<DayClosureStats> {
  // Fetch the toggle from store_settings (column may not exist on older DBs — default TRUE)
  let includeDeliveryInDrawer = true;
  try {
    const settingsRes = await executor.query(
      `SELECT include_delivery_in_drawer FROM store_settings WHERE store_id = $1`,
      [storeId]
    );
    if (settingsRes.rows.length > 0 && settingsRes.rows[0].include_delivery_in_drawer != null) {
      includeDeliveryInDrawer = Boolean(settingsRes.rows[0].include_delivery_in_drawer);
    }
  } catch {
    // Column doesn't exist yet — treat as enabled (safe default)
  }

  const saleAgg = await executor.query(
    `
      SELECT
        COALESCE(COUNT(*)::int, 0) AS total_transactions,
        COALESCE(SUM(s.grand_total), 0)::numeric AS gross_sales,
        COALESCE(SUM(COALESCE(s.delivery_charge, 0)), 0)::numeric AS delivery_total
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

  const delivery_total = roundMoney(Number(sr.delivery_total));
  const gross_sales = roundMoney(Number(sr.gross_sales));
  // When delivery is not in drawer, subtract it from the revenue total
  const total_sales = includeDeliveryInDrawer
    ? gross_sales
    : roundMoney(gross_sales - delivery_total);

  // Sum all unclosed expenses for this store
  const expAgg = await executor.query(
    `SELECT COALESCE(SUM(amount), 0)::numeric AS total_expenses
     FROM expenses
     WHERE store_id = $1 AND day_closure_id IS NULL`,
    [storeId]
  );
  const total_expenses = roundMoney(Number(expAgg.rows[0].total_expenses));

  return {
    total_transactions: Number(sr.total_transactions) || 0,
    total_sales,
    cash_expected: roundMoney(Number(pr.cash_expected)),
    card_total: roundMoney(Number(pr.card_total)),
    other_payments,
    voucher_total,
    total_expenses,
    delivery_total,
    include_delivery_in_drawer: includeDeliveryInDrawer,
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
    const storeInfoResult = await pool.query(
      `SELECT s.name, ss.currency_code, ss.lbp_exchange_rate, ss.round_lbp_to_1000 
       FROM stores s
       LEFT JOIN store_settings ss ON s.store_id = ss.store_id
       WHERE s.store_id = $1`,
      [storeId]
    );
    
    const info = storeInfoResult.rows[0] || { name: null, currency_code: 'USD', lbp_exchange_rate: null, round_lbp_to_1000: false };

    const data = await computePreview(pool, storeId);
    return { 
      store_id: storeId, 
      store_name: info.name, 
      ...data,
      currency_code: info.currency_code,
      lbp_exchange_rate: info.lbp_exchange_rate ? Number(info.lbp_exchange_rate) : null,
      round_lbp_to_1000: info.round_lbp_to_1000
    };
  }

  static async close(
    storeId: string,
    closedByUserId: string,
    cashActual: number,
    notes: string | null,
    cashBreakdown: any | null = null
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
          total_expenses,
          closed_by,
          z_number,
          notes,
          cash_breakdown
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
          $11,
          $12,
          $13
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
          preview.total_expenses,
          closedByUserId,
          z_number,
          notes?.trim() || null,
          cashBreakdown ? JSON.stringify(cashBreakdown) : null,
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

      // Attach all unclosed expenses to this closure
      await ExpensesModel.attachToClosureClient(client, storeId, row.id);

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
