import type { PoolClient } from 'pg';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { SaleModel } from './SaleModel';
import { ExpensesModel } from './ExpensesModel';

export interface DayClosureStats {
  total_sales: number;        // revenues counted in drawer (may exclude delivery)
  total_transactions: number;
  gross_cash: number;         // raw sum of method='cash' payments before any deductions
  cash_refunds_out: number;   // cash paid out for refunds (method='other', negative amounts) — positive value
  cash_expected: number;      // net expected cash = gross_cash − cash_refunds_out − total_expenses
  card_total: number;
  other_payments: number;
  voucher_total: number;
  total_expenses: number;
  delivery_total: number;           // sum of all delivery charges in the period
  include_delivery_in_drawer: boolean;
}

export interface OpeningFloatInfo {
  opening_float: number;
  opening_float_breakdown: any | null;
  previous_z_number: number | null;
  previous_closed_at: string | null;
}

export interface DayClosurePreview extends DayClosureStats, OpeningFloatInfo {
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
  opening_float: number;
  opening_float_breakdown: any | null;
  cash_left_in_drawer: number;
  cash_left_in_drawer_breakdown: any | null;
  cash_to_bank: number;
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
        COALESCE(SUM(COALESCE(s.delivery_charge, 0)), 0)::numeric AS delivery_total,
        COALESCE(SUM(
          CASE 
            WHEN $2 = true THEN s.grand_total
            ELSE s.grand_total - CASE 
              WHEN s.grand_total >= (COALESCE(s.subtotal, 0) + COALESCE(s.tax_total, 0) - COALESCE(s.discount_total, 0) + COALESCE(s.delivery_charge, 0) - 0.01)
              THEN COALESCE(s.delivery_charge, 0)
              ELSE 0
            END
          END
        ), 0)::numeric AS drawer_total
      FROM sales s
      WHERE s.store_id = $1
        AND s.status = 'paid'
        AND (s.day_closure_id IS NULL)
    `,
    [storeId, includeDeliveryInDrawer]
  );

  const payAgg = await executor.query(
    `
      SELECT
        COALESCE(SUM(CASE WHEN sp.method = 'cash' THEN sp.amount::numeric ELSE 0 END), 0) AS gross_cash,
        COALESCE(SUM(CASE WHEN sp.method = 'other' AND sp.amount::numeric < 0 THEN sp.amount::numeric ELSE 0 END), 0) AS refund_cash_out,
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
  const total_sales = roundMoney(Number(sr.drawer_total));

  // Sum all unclosed expenses for this store
  const expAgg = await executor.query(
    `SELECT COALESCE(SUM(amount), 0)::numeric AS total_expenses
     FROM expenses
     WHERE store_id = $1 AND day_closure_id IS NULL`,
    [storeId]
  );
  const total_expenses = roundMoney(Number(expAgg.rows[0].total_expenses));

  const gross_cash = roundMoney(Number(pr.gross_cash));
  // refund_cash_out is stored as a negative sum; take absolute value for reporting
  const cash_refunds_out = roundMoney(Math.abs(Number(pr.refund_cash_out)));
  // Net expected cash: start from cash sales, subtract refund payouts and expenses
  const cash_expected = roundMoney(gross_cash - cash_refunds_out - total_expenses);

  return {
    total_transactions: Number(sr.total_transactions) || 0,
    total_sales,
    gross_cash,
    cash_refunds_out,
    cash_expected,
    card_total: roundMoney(Number(pr.card_total)),
    other_payments,
    voucher_total,
    total_expenses,
    delivery_total,
    include_delivery_in_drawer: includeDeliveryInDrawer,
  };
}

// The float left in the drawer by the most recent prior closure becomes the
// opening float for the next one — it's physically still sitting in the drawer.
async function getOpeningFloat(
  executor: Pick<PoolClient, 'query'>,
  storeId: string
): Promise<OpeningFloatInfo> {
  const r = await executor.query(
    `SELECT z_number, closed_at, cash_left_in_drawer, cash_left_in_drawer_breakdown
     FROM day_closures
     WHERE store_id = $1
     ORDER BY closed_at DESC, z_number DESC
     LIMIT 1`,
    [storeId]
  );
  if (r.rows.length === 0) {
    return {
      opening_float: 0,
      opening_float_breakdown: null,
      previous_z_number: null,
      previous_closed_at: null,
    };
  }
  const row = r.rows[0];
  return {
    opening_float: roundMoney(Number(row.cash_left_in_drawer) || 0),
    opening_float_breakdown: row.cash_left_in_drawer_breakdown ?? null,
    previous_z_number: Number(row.z_number),
    previous_closed_at: row.closed_at,
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
    const floatInfo = await getOpeningFloat(pool, storeId);
    const cash_expected = roundMoney(floatInfo.opening_float + data.cash_expected);
    return {
      store_id: storeId,
      store_name: info.name,
      ...data,
      cash_expected,
      ...floatInfo,
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
    cashBreakdown: any | null = null,
    cashLeftInDrawer: number = 0,
    cashLeftInDrawerBreakdown: any | null = null,
    openingFloatOverride?: number | null,
    openingFloatBreakdownOverride?: any | null
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

      const defaultFloat = await getOpeningFloat(client, storeId);
      const opening_float =
        openingFloatOverride != null && Number.isFinite(openingFloatOverride)
          ? roundMoney(Math.max(0, openingFloatOverride))
          : defaultFloat.opening_float;
      const opening_float_breakdown =
        openingFloatOverride != null ? openingFloatBreakdownOverride ?? null : defaultFloat.opening_float_breakdown;

      const cash_expected = roundMoney(opening_float + preview.cash_expected);
      const cash_difference = roundMoney(cashActual - cash_expected);

      if (cashLeftInDrawer > cashActual) {
        await client.query('ROLLBACK');
        throw new Error('cash_left_in_drawer cannot exceed cash counted');
      }
      const cash_to_bank = roundMoney(cashActual - cashLeftInDrawer);

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
          cash_breakdown,
          opening_float,
          opening_float_breakdown,
          cash_left_in_drawer,
          cash_left_in_drawer_breakdown,
          cash_to_bank
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
          $13,
          $14,
          $15,
          $16,
          $17,
          $18
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
          opening_float,
          opening_float_breakdown ? JSON.stringify(opening_float_breakdown) : null,
          roundMoney(cashLeftInDrawer),
          cashLeftInDrawerBreakdown ? JSON.stringify(cashLeftInDrawerBreakdown) : null,
          cash_to_bank,
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
