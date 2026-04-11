import { BaseModel, PaginatedResult } from './BaseModel';
import { CustomError } from '../middleware/errorHandler';
import { pool } from '../config/database';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';
import { StoreSettingsModel } from './StoreSettingsModel';
import {
  aggregateLines,
  computeLineAmounts,
  roundMoney,
  saleDiscountAndGrand,
  totalsFromPersistedItems,
  type SaleTaxMode,
} from '../utils/saleTaxTotals';

export type SaleStatus = 'open' | 'paid' | 'void' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'voucher' | 'other';

export interface Sale {
  sale_id: string;
  store_id: string;
  terminal_id: string;
  cashier_id: string;
  customer_id?: string;
  receipt_no: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  discount_rate?: number;  // Discount percentage (0-100)
  grand_total: number;
  paid_total: number;
  status: SaleStatus;
  created_at: string;
  /** Set when sale is included in a day closure (Z); locked from edit/delete/cancel */
  day_closure_id?: number | null;
}

export interface SaleItem {
  sale_item_id: string;
  sale_id: string;
  product_id: string;
  product_name?: string;
  book_id?: string;
  unit_of_measure?: string;
  qty: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
}

export interface SalePayment {
  sale_payment_id: string;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
}

export interface CreateSaleData {
  customer_id?: string;
  client_sale_id?: string; // Unique client-side sale ID for conflict resolution
  discount_rate?: number;  // Discount percentage (0-100)
  items: {
    product_id: string;
    qty: number;
    unit_price: number;
    tax_rate?: number;
  }[];
  payments: {
    method: PaymentMethod;
    amount: number;
  }[];
  restaurant_context?: {
    table_number: number;
    guest_count: number;
    waiter_name?: string;
    seated_at: string;
    checkout_at: string;
    service_fee_enabled: boolean;
    service_fee_rate: number;
    service_fee_amount: number;
    subtotal_before_service: number;
    notes?: string;
  };
}

export interface UpdateSaleData {
  customer_id?: string;
  discount_rate?: number;
  items?: {
    product_id: string;
    qty: number;
    unit_price: number;
    tax_rate?: number;
  }[];
  payments?: {
    method: PaymentMethod;
    amount: number;
  }[];
}

export interface SaleWithDetails extends Sale {
  items: SaleItem[];
  payments: SalePayment[];
  customer?: {
    customer_id: string;
    full_name?: string;
    phone?: string;
  };
  store_name?: string;
  terminal_name?: string;
  cashier_name?: string;
}

export interface SaleFilters {
  search?: string;
  status?: SaleStatus;
  customer_id?: string;
  store_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export class SaleModel extends BaseModel {
  private static async persistRestaurantContext(
    client: any,
    sale: { sale_id: string; store_id: string; terminal_id: string },
    cashierId: string,
    context: NonNullable<CreateSaleData['restaurant_context']>
  ): Promise<void> {
    const sessionResult = await client.query(
      `
        INSERT INTO restaurant_table_sessions (
          store_id,
          terminal_id,
          cashier_id,
          table_number,
          guest_count,
          waiter_name,
          seated_at,
          closed_at,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, 'closed')
        RETURNING session_id
      `,
      [
        sale.store_id,
        sale.terminal_id,
        cashierId,
        context.table_number,
        context.guest_count,
        context.waiter_name || null,
        context.seated_at,
        context.checkout_at,
      ]
    );

    const sessionId = sessionResult.rows[0]?.session_id || null;

    await client.query(
      `
        INSERT INTO restaurant_sale_context (
          sale_id,
          session_id,
          service_fee_enabled,
          service_fee_rate,
          service_fee_amount,
          subtotal_before_service,
          checkout_at,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8)
      `,
      [
        sale.sale_id,
        sessionId,
        context.service_fee_enabled,
        context.service_fee_rate,
        context.service_fee_amount,
        context.subtotal_before_service,
        context.checkout_at,
        context.notes || null,
      ]
    );
  }

  // Get default store (first active store) with settings
  // Cached for 10 minutes to reduce database load
  static async getDefaultStore(): Promise<{ store_id: string; code: string; name: string } | null> {
    const cacheKey = 'default_store';

    // Check cache first
    const cached = cache.get<{ store_id: string; code: string; name: string }>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const query = `
      SELECT store_id, code, name
      FROM stores
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.query(query);
    const store = result.rows[0] || null;

    // Cache result for 10 minutes
    if (store) {
      cache.set(cacheKey, store, 10 * 60 * 1000);
    }

    return store;
  }

  // Get default terminal for store
  // Cached for 10 minutes to reduce database load
  static async getDefaultTerminal(storeId: string): Promise<{ terminal_id: string; code: string; name: string } | null> {
    const cacheKey = `default_terminal_${storeId}`;

    // Check cache first
    const cached = cache.get<{ terminal_id: string; code: string; name: string }>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const query = `
      SELECT terminal_id, code, name
      FROM terminals
      WHERE store_id = $1 AND is_active = true
      ORDER BY created_at ASC
      LIMIT 1
    `;
    const result = await this.query(query, [storeId]);
    const terminal = result.rows[0] || null;

    // Cache result for 10 minutes
    if (terminal) {
      cache.set(cacheKey, terminal, 10 * 60 * 1000);
    }

    return terminal;
  }

  // Generate receipt number using atomic counter to prevent race conditions
  // Uses single atomic operation: INSERT with ON CONFLICT DO UPDATE
  // Accepts optional client for use within transactions
  static async generateReceiptNo(storeId: string, client?: any): Promise<string> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Single atomic operation: initialize if needed, then increment and return
    // This prevents race conditions by combining INSERT and UPDATE in one query
    const queryText = `INSERT INTO daily_receipt_counters (store_id, date, counter)
       VALUES ($1, $2, 1)
       ON CONFLICT (store_id, date) 
       DO UPDATE SET 
         counter = daily_receipt_counters.counter + 1,
         updated_at = NOW()
       RETURNING counter`;

    const result = client
      ? await client.query(queryText, [storeId, today])
      : await this.query(queryText, [storeId, today]);

    if (result.rows.length === 0) {
      throw new Error('Failed to generate receipt number: counter operation failed');
    }

    const count = parseInt(result.rows[0].counter, 10);

    // Format: YYYYMMDD-XXXX (e.g., 20231205-0001)
    const date = today.replace(/-/g, '');
    const sequence = String(count).padStart(4, '0');
    return `${date}-${sequence}`;
  }

  // Create sale with REPEATABLE READ isolation and row-level locking
  // REPEATABLE READ is more performant than SERIALIZABLE while still preventing race conditions
  // with proper row-level locking (FOR UPDATE)
  static async create(
    cashierId: string,
    data: CreateSaleData
  ): Promise<SaleWithDetails> {
    return await withRetry(
      async () => {
        const client = await pool.connect();

        try {
          await client.query('BEGIN');
          // Set transaction timeout (30 seconds) to prevent long-running transactions
          await client.query('SET LOCAL statement_timeout = 30000');
          // Set lock timeout (5 seconds) to prevent indefinite blocking
          await client.query('SET LOCAL lock_timeout = 5000');
          // Set REPEATABLE READ isolation level (more performant than SERIALIZABLE)
          // Row-level locking (FOR UPDATE) provides sufficient protection against race conditions
          await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

          // Check for duplicate sale (idempotency check) if client_sale_id is provided
          // Gracefully handle if column doesn't exist yet
          if (data.client_sale_id) {
            try {
              const duplicateCheck = await client.query(
                'SELECT sale_id FROM sales WHERE client_sale_id = $1',
                [data.client_sale_id]
              );
              if (duplicateCheck.rows.length > 0) {
                // Sale already exists - rollback and return existing sale
                await client.query('ROLLBACK');
                logger.info(`Duplicate sale detected with client_sale_id: ${data.client_sale_id}, returning existing sale`);
                const existingSaleId = duplicateCheck.rows[0].sale_id;
                const existingSale = await this.findById(existingSaleId);
                if (existingSale) {
                  return existingSale;
                }
                // If findById fails, throw error
                throw new Error('Duplicate sale found but could not retrieve details');
              }
            } catch (error: any) {
              // If column doesn't exist, skip duplicate check (graceful degradation)
              if (error.message?.includes('column') && error.message?.includes('client_sale_id')) {
                logger.warn('client_sale_id column does not exist, skipping duplicate check');
                // Continue with sale creation
              } else {
                throw error;
              }
            }
          }

          // Get store and terminal INSIDE transaction to prevent mid-transaction changes
          // Query stores table with lock to ensure consistency
          const storeQuery = await client.query(`
        SELECT store_id, code, name
        FROM stores
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `);
          const store = storeQuery.rows[0];
          if (!store) {
            throw new Error('No active store found');
          }

          // Get store settings to check allow_negative and tax mode
          const storeSettings = await StoreSettingsModel.findByStoreId(store.store_id);
          const allowNegative = storeSettings?.allow_negative ?? false;
          const taxInclusive = !!(storeSettings?.tax_inclusive ?? false);
          const defaultTaxRate = roundMoney(Number(storeSettings?.tax_rate ?? 0));
          const taxMode: SaleTaxMode = taxInclusive ? 'inclusive' : 'exclusive';

          // Get terminal INSIDE transaction with lock
          const terminalQuery = await client.query(`
        SELECT terminal_id, code, name
        FROM terminals
        WHERE store_id = $1 AND is_active = true
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE
      `, [store.store_id]);
          const terminal = terminalQuery.rows[0];
          if (!terminal) {
            throw new Error('No active terminal found for store');
          }

          // Generate receipt number (within transaction for atomicity)
          const receiptNo = await this.generateReceiptNo(store.store_id, client);

          // Calculate totals (tax-inclusive: gross shelf prices + extracted tax; tax-off: no tax)
          const computedLines: ReturnType<typeof computeLineAmounts>[] = [];
          for (const item of data.items) {
            let effRate = 0;
            if (taxInclusive) {
              if (item.tax_rate !== undefined && item.tax_rate !== null) {
                effRate = Number(item.tax_rate);
              } else {
                const pr = await client.query('SELECT tax_rate FROM products WHERE product_id = $1', [
                  item.product_id,
                ]);
                const pt = pr.rows[0]?.tax_rate;
                if (pt != null && pt !== '') {
                  effRate = Number(pt);
                } else {
                  effRate = defaultTaxRate;
                }
              }
              effRate = Math.min(100, Math.max(0, effRate));
            }
            computedLines.push(
              computeLineAmounts(
                { qty: item.qty, unit_price: item.unit_price, tax_rate: effRate },
                taxMode
              )
            );
          }

          const { subtotal, taxTotal, merchandiseGross } = aggregateLines(computedLines);
          const discountRate = data.discount_rate || 0;
          const { discountTotal, grandTotal } = saleDiscountAndGrand(merchandiseGross, discountRate);
          const paidTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);

          if (paidTotal < grandTotal - 0.01) { // Allow for tiny epsilon differences
            throw new Error('Payment amount is less than grand total');
          }

          // Create sale
          // Check if client_sale_id and discount_rate columns exist before including them
          let saleQuery: string;
          let saleValues: any[];

          try {
            // Check if columns exist
            const columnCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'sales' AND column_name IN ('client_sale_id', 'discount_rate')
        `);

            const hasClientSaleId = columnCheck.rows.some((r: any) => r.column_name === 'client_sale_id');
            const hasDiscountRate = columnCheck.rows.some((r: any) => r.column_name === 'discount_rate');

            let paramCount = 11; // Base parameters
            const columns: string[] = [
              'store_id', 'terminal_id', 'cashier_id', 'customer_id',
              'receipt_no', 'subtotal', 'tax_total', 'discount_total',
              'grand_total', 'paid_total', 'status'
            ];
            const values: any[] = [
              store.store_id,
              terminal.terminal_id,
              cashierId,
              data.customer_id || null,
              receiptNo,
              subtotal,
              taxTotal,
              discountTotal,
              grandTotal,
              paidTotal,
              'paid',
            ];

            if (hasDiscountRate) {
              columns.push('discount_rate');
              paramCount++;
              values.push(discountRate);
            }

            if (hasClientSaleId) {
              columns.push('client_sale_id');
              paramCount++;
              values.push(data.client_sale_id || null);
            }

            const placeholders = Array.from({ length: paramCount }, (_, i) => `$${i + 1}`).join(', ');

            saleQuery = `
          INSERT INTO sales (${columns.join(', ')})
          VALUES (${placeholders})
          RETURNING *
        `;
            saleValues = values;
          } catch (error) {
            // Fallback: assume columns don't exist
            saleQuery = `
          INSERT INTO sales (
            store_id, terminal_id, cashier_id, customer_id,
            receipt_no, subtotal, tax_total, discount_total,
            grand_total, paid_total, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;
            saleValues = [
              store.store_id,
              terminal.terminal_id,
              cashierId,
              data.customer_id || null,
              receiptNo,
              subtotal,
              taxTotal,
              discountTotal,
              grandTotal,
              paidTotal,
              'paid',
            ];
          }

          const saleResult = await client.query(saleQuery, saleValues);
          const sale = saleResult.rows[0];

          // Create sale items
          const items: SaleItem[] = [];
          for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            const amounts = computedLines[i];

            const itemQuery = `
          INSERT INTO sale_items (
            sale_id, product_id, qty, unit_price, tax_rate, line_total
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;
            const itemValues = [
              sale.sale_id,
              item.product_id,
              item.qty,
              amounts.unit_price,
              amounts.tax_rate,
              amounts.line_total,
            ];
            const itemResult = await client.query(itemQuery, itemValues);
            items.push(itemResult.rows[0]);

            // Update stock if product tracks inventory
            // Lock stock balance row to prevent race conditions
            const productQuery = `
          SELECT track_inventory FROM products WHERE product_id = $1
        `;
            const productResult = await client.query(productQuery, [item.product_id]);
            if (productResult.rows[0]?.track_inventory) {
              // Lock stock balance row for update (prevents concurrent modifications)
              const stockBalanceResult = await client.query(`
            SELECT qty_on_hand FROM stock_balances
            WHERE store_id = $1 AND product_id = $2
            FOR UPDATE
          `, [store.store_id, item.product_id]);

              // Validate stock availability ONLY if allow_negative is false
              if (!allowNegative) {
                const currentStock = stockBalanceResult.rows[0]?.qty_on_hand || 0;
                if (currentStock < item.qty) {
                  // Get product name for error message
                  const productInfo = await client.query(
                    'SELECT name FROM products WHERE product_id = $1',
                    [item.product_id]
                  );
                  const productName = productInfo.rows[0]?.name || 'Unknown product';
                  throw new Error(
                    `Insufficient stock for ${productName}. Available: ${currentStock}, Requested: ${item.qty}`
                  );
                }
              } else {
                // Log when negative stock is allowed (for auditing/debugging)
                const currentStock = stockBalanceResult.rows[0]?.qty_on_hand || 0;
                if (currentStock < item.qty) {
                  logger.info(`Negative stock allowed: Product ${item.product_id}, Current: ${currentStock}, Selling: ${item.qty}`, {
                    store_id: store.store_id,
                    product_id: item.product_id,
                    current_stock: currentStock,
                    qty_sold: item.qty,
                    receipt_no: sale.receipt_no
                  });
                }
              }

              // Create stock movement (outbound)
              const stockQuery = `
            INSERT INTO stock_movements (
              store_id, product_id, reason, qty, reference, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `;
              await client.query(stockQuery, [
                store.store_id,
                item.product_id,
                'sale',
                -item.qty, // Negative for outbound
                sale.receipt_no,
                cashierId,
              ]);

              // Update stock balance atomically (maintain O(1) query performance)
              await client.query(`
            INSERT INTO stock_balances (store_id, product_id, qty_on_hand)
            VALUES ($1, $2, $3)
            ON CONFLICT (store_id, product_id)
            DO UPDATE SET 
              qty_on_hand = stock_balances.qty_on_hand + $3,
              updated_at = NOW()
          `, [store.store_id, item.product_id, -item.qty]); // Negative for sale (outbound)
            }
          }

          // Create sale payments
          const payments: SalePayment[] = [];
          for (const payment of data.payments) {
            const paymentQuery = `
          INSERT INTO sale_payments (sale_id, method, amount)
          VALUES ($1, $2, $3)
          RETURNING *
        `;
            const paymentResult = await client.query(paymentQuery, [
              sale.sale_id,
              payment.method,
              payment.amount,
            ]);
            payments.push(paymentResult.rows[0]);
          }

          if (data.restaurant_context) {
            await this.persistRestaurantContext(client, sale, cashierId, data.restaurant_context);
          }

          await client.query('COMMIT');

          return {
            ...sale,
            items,
            payments,
          };
        } catch (error) {
          // Always rollback on error
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            // Log rollback error but don't mask original error
            logger.error('Failed to rollback transaction', { error: rollbackError });
          }
          throw error;
        } finally {
          // Always release client, even if rollback failed
          try {
            client.release();
          } catch (releaseError) {
            // Log release error - this is critical
            logger.error('Failed to release database client', { error: releaseError });
          }
        }
      },
      {
        maxAttempts: 3,
        backoffMs: 100,
        onRetry: (attempt, error) => {
          logger.warn(`Retrying sale creation (attempt ${attempt})`, {
            error: error.message,
            code: (error as any).code,
          });
        },
      }
    );
  }

  // Update sale
  static async update(
    saleId: string,
    cashierId: string,
    data: UpdateSaleData
  ): Promise<SaleWithDetails> {
    return await withRetry(
      async () => {
        const client = await pool.connect();

        try {
          await client.query('BEGIN');
          await client.query('SET LOCAL statement_timeout = 30000');
          await client.query('SET LOCAL lock_timeout = 5000');
          await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

          const lockRow = await client.query(
            `SELECT day_closure_id FROM sales WHERE sale_id = $1 FOR UPDATE`,
            [saleId]
          );
          if (lockRow.rows.length === 0) {
            await client.query('ROLLBACK');
            throw new Error('Sale not found');
          }
          if (lockRow.rows[0].day_closure_id != null) {
            await client.query('ROLLBACK');
            throw new CustomError('Sale is included in a day closure and cannot be modified', 409);
          }

          // Get existing sale
          const existingSale = await this.findById(saleId);
          if (!existingSale) {
            await client.query('ROLLBACK');
            throw new Error('Sale not found');
          }

          const editStoreSettings = await StoreSettingsModel.findByStoreId(existingSale.store_id);
          const editTaxInclusive = !!(editStoreSettings?.tax_inclusive ?? false);
          const editDefaultTax = roundMoney(Number(editStoreSettings?.tax_rate ?? 0));
          const editTaxMode: SaleTaxMode = editTaxInclusive ? 'inclusive' : 'exclusive';

          // Update customer if provided
          if (data.customer_id !== undefined) {
            const updateQuery = `
              UPDATE sales 
              SET customer_id = $1 
              WHERE sale_id = $2
            `;
            await client.query(updateQuery, [data.customer_id || null, saleId]);
          }

          // Update items if provided
          if (data.items) {
            if (data.items.length === 0) {
              await client.query('ROLLBACK');
              throw new Error('Sale must have at least one item');
            }

            // Fetch existing items WITH track_inventory BEFORE deleting so we can reverse their stock
            const oldItemsResult = await client.query(
              `SELECT si.product_id, si.qty, p.track_inventory
               FROM sale_items si
               LEFT JOIN products p ON p.product_id = si.product_id
               WHERE si.sale_id = $1`,
              [saleId]
            );

            // Reverse stock for each old item that tracked inventory
            for (const oldItem of oldItemsResult.rows) {
              if (oldItem.track_inventory) {
                // Remove the stock movements recorded for this sale+product
                await client.query(
                  `DELETE FROM stock_movements
                   WHERE store_id = $1 AND product_id = $2 AND reference = $3 AND reason = 'sale'`,
                  [existingSale.store_id, oldItem.product_id, existingSale.receipt_no]
                );
                // Add the sold qty back to stock
                await client.query(`
                  INSERT INTO stock_balances (store_id, product_id, qty_on_hand)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (store_id, product_id)
                  DO UPDATE SET
                    qty_on_hand = stock_balances.qty_on_hand + $3,
                    updated_at = NOW()
                `, [existingSale.store_id, oldItem.product_id, Math.abs(Number(oldItem.qty))]);
              }
            }

            // Delete existing items
            await client.query('DELETE FROM sale_items WHERE sale_id = $1', [saleId]);

            const editComputedLines: ReturnType<typeof computeLineAmounts>[] = [];
            for (const item of data.items) {
              let effRate = 0;
              if (editTaxInclusive) {
                if (item.tax_rate !== undefined && item.tax_rate !== null) {
                  effRate = Number(item.tax_rate);
                } else {
                  const pr = await client.query('SELECT tax_rate FROM products WHERE product_id = $1', [
                    item.product_id,
                  ]);
                  const pt = pr.rows[0]?.tax_rate;
                  if (pt != null && pt !== '') {
                    effRate = Number(pt);
                  } else {
                    effRate = editDefaultTax;
                  }
                }
                effRate = Math.min(100, Math.max(0, effRate));
              }
              editComputedLines.push(
                computeLineAmounts(
                  { qty: item.qty, unit_price: item.unit_price, tax_rate: effRate },
                  editTaxMode
                )
              );
            }

            for (let i = 0; i < data.items.length; i++) {
              const item = data.items[i];
              const amounts = editComputedLines[i];
              await client.query(
                `
                INSERT INTO sale_items (sale_id, product_id, qty, unit_price, tax_rate, line_total)
                VALUES ($1, $2, $3, $4, $5, $6)
              `,
                [saleId, item.product_id, item.qty, amounts.unit_price, amounts.tax_rate, amounts.line_total]
              );

              // Record stock movement for the new item qty
              const trackResult = await client.query(
                'SELECT track_inventory FROM products WHERE product_id = $1',
                [item.product_id]
              );
              if (trackResult.rows[0]?.track_inventory) {
                await client.query(
                  `INSERT INTO stock_movements (store_id, product_id, reason, qty, reference, created_by)
                   VALUES ($1, $2, 'sale', $3, $4, $5)`,
                  [existingSale.store_id, item.product_id, -item.qty, existingSale.receipt_no, cashierId]
                );
                await client.query(`
                  INSERT INTO stock_balances (store_id, product_id, qty_on_hand)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (store_id, product_id)
                  DO UPDATE SET
                    qty_on_hand = stock_balances.qty_on_hand + $3,
                    updated_at = NOW()
                `, [existingSale.store_id, item.product_id, -item.qty]);
              }
            }
          }

          // Update payments if provided
          if (data.payments) {
            if (data.payments.length === 0) {
              await client.query('ROLLBACK');
              throw new Error('Sale must have at least one payment');
            }

            // Delete existing payments
            await client.query('DELETE FROM sale_payments WHERE sale_id = $1', [saleId]);

            // Insert new payments
            for (const payment of data.payments) {
              await client.query(`
                INSERT INTO sale_payments (sale_id, method, amount)
                VALUES ($1, $2, $3)
              `, [saleId, payment.method, payment.amount]);
            }
          }

          // Update discount if provided
          if (data.discount_rate !== undefined) {
            try {
              const updateQuery = `
                  UPDATE sales 
                  SET discount_rate = $1 
                  WHERE sale_id = $2
                `;
              await client.query(updateQuery, [data.discount_rate, saleId]);
            } catch (err: any) {
              if (err.message?.includes('column') && err.message?.includes('discount_rate')) {
                logger.warn('discount_rate column does not exist, skipping update');
              } else {
                throw err;
              }
            }
          }

          // Recalculate totals
          const itemsResult = await client.query(
            'SELECT * FROM sale_items WHERE sale_id = $1',
            [saleId]
          );
          const items = itemsResult.rows;

          // Determine discount rate
          let currentDiscountRate = 0;
          if (data.discount_rate !== undefined) {
            currentDiscountRate = data.discount_rate;
          } else {
            try {
              const saleQuery = await client.query('SELECT discount_rate FROM sales WHERE sale_id = $1', [saleId]);
              currentDiscountRate = Number(saleQuery.rows[0]?.discount_rate || 0);
            } catch (err) {
              // Ignore if column doesn't exist
            }
          }

          const persistedRows = items.map((row: any) => ({
            qty: Number(row.qty),
            unit_price: Number(row.unit_price),
            tax_rate: Number(row.tax_rate) || 0,
          }));
          const { subtotal, taxTotal, merchandiseGross } = totalsFromPersistedItems(
            persistedRows,
            editTaxInclusive
          );
          const { discountTotal, grandTotal } = saleDiscountAndGrand(
            merchandiseGross,
            currentDiscountRate
          );

          const paymentsResult = await client.query(
            'SELECT * FROM sale_payments WHERE sale_id = $1',
            [saleId]
          );
          const paidTotal = paymentsResult.rows.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);

          if (paidTotal < grandTotal - 0.01) {
            await client.query('ROLLBACK');
            throw new Error('Payment amount is less than grand total');
          }

          // Update sale totals
          await client.query(`
            UPDATE sales 
            SET subtotal = $1, tax_total = $2, discount_total = $3, 
                grand_total = $4, paid_total = $5
            WHERE sale_id = $6
          `, [subtotal, taxTotal, discountTotal, grandTotal, paidTotal, saleId]);

          await client.query('COMMIT');

          // Return updated sale
          const updatedSale = await this.findById(saleId);
          if (!updatedSale) {
            throw new Error('Failed to retrieve updated sale');
          }
          return updatedSale;
        } catch (error) {
          // Always rollback on error
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            logger.error('Failed to rollback transaction', { error: rollbackError });
          }
          throw error;
        } finally {
          // Always release client
          try {
            client.release();
          } catch (releaseError) {
            logger.error('Failed to release database client', { error: releaseError });
          }
        }
      },
      {
        maxAttempts: 3,
        backoffMs: 100,
        onRetry: (attempt, error) => {
          logger.warn(`Retrying sale update (attempt ${attempt})`, {
            error: error.message,
            code: (error as any).code,
          });
        },
      }
    );
  }

  // Cancel sale
  static async cancel(
    saleId: string,
    cashierId: string
  ): Promise<SaleWithDetails> {
    return await withRetry(
      async () => {
        const client = await pool.connect();

        try {
          await client.query('BEGIN');
          await client.query('SET LOCAL statement_timeout = 30000');
          await client.query('SET LOCAL lock_timeout = 5000');
          await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

          const cancelLock = await client.query(
            `SELECT day_closure_id, status FROM sales WHERE sale_id = $1 FOR UPDATE`,
            [saleId]
          );
          if (cancelLock.rows.length === 0) {
            await client.query('ROLLBACK');
            throw new Error('Sale not found');
          }
          if (cancelLock.rows[0].day_closure_id != null) {
            await client.query('ROLLBACK');
            throw new CustomError('Sale is included in a day closure and cannot be modified', 409);
          }

          // Get existing sale
          const existingSale = await this.findById(saleId);
          if (!existingSale) {
            await client.query('ROLLBACK');
            throw new Error('Sale not found');
          }

          if (existingSale.status === 'cancelled') {
            await client.query('ROLLBACK');
            throw new Error('Sale is already cancelled');
          }

          // Update sale status
          const updateQuery = `
            UPDATE sales 
            SET status = 'cancelled' 
            WHERE sale_id = $1
          `;
          await client.query(updateQuery, [saleId]);

          // Get items to reverse inventory
          const itemsResult = await client.query(
            'SELECT * FROM sale_items WHERE sale_id = $1',
            [saleId]
          );
          const items = itemsResult.rows;

          // Process stock reversions
          for (const item of items) {
             // Check if product tracks inventory
             const productQuery = `
              SELECT track_inventory FROM products WHERE product_id = $1
            `;
            const productResult = await client.query(productQuery, [item.product_id]);

            if (productResult.rows[0]?.track_inventory) {
               // Create stock movement (inbound reversion)
               const stockQuery = `
                INSERT INTO stock_movements (
                  store_id, product_id, reason, qty, reference, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6)
              `;
              await client.query(stockQuery, [
                existingSale.store_id,
                item.product_id,
                'cancelled',
                Math.abs(item.qty), // Positive for reverting a sale 
                existingSale.receipt_no,
                cashierId,
              ]);

              // Update stock balance atomically
              await client.query(`
                INSERT INTO stock_balances (store_id, product_id, qty_on_hand)
                VALUES ($1, $2, $3)
                ON CONFLICT (store_id, product_id)
                DO UPDATE SET 
                  qty_on_hand = stock_balances.qty_on_hand + $3,
                  updated_at = NOW()
              `, [existingSale.store_id, item.product_id, Math.abs(item.qty)]);
            }
          }

          await client.query('COMMIT');
          
          const updatedSale = await this.findById(saleId);
          return updatedSale as SaleWithDetails;
        } catch (error) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            logger.error('Failed to rollback transaction', { error: rollbackError });
          }
          throw error;
        } finally {
          try {
            client.release();
          } catch (releaseError) {
            logger.error('Failed to release database client', { error: releaseError });
          }
        }
      },
      {
        maxAttempts: 3,
        backoffMs: 100,
        onRetry: (attempt, error) => {
          logger.warn(`Retrying sale cancellation (attempt ${attempt})`, {
            error: error.message,
            code: (error as any).code,
          });
        },
      }
    );
  }

  // Hard-delete a sale (admin only) — removes all related records
  static async deleteSale(saleId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify sale exists and is not day-closed
      const existing = await client.query(
        'SELECT sale_id, store_id, receipt_no, status, day_closure_id FROM sales WHERE sale_id = $1',
        [saleId]
      );
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('Sale not found');
      }
      if (existing.rows[0].day_closure_id != null) {
        await client.query('ROLLBACK');
        throw new CustomError('Sale is included in a day closure and cannot be modified', 409);
      }

      const { store_id, receipt_no, status } = existing.rows[0];

      // Reverse stock for items that tracked inventory.
      // If the sale was already cancelled its stock was already restored, so skip.
      if (status !== 'cancelled') {
        const itemsResult = await client.query(
          `SELECT si.product_id, si.qty, p.track_inventory
           FROM sale_items si
           LEFT JOIN products p ON p.product_id = si.product_id
           WHERE si.sale_id = $1`,
          [saleId]
        );
        for (const item of itemsResult.rows) {
          if (item.track_inventory) {
            // Add the sold qty back to stock
            await client.query(`
              INSERT INTO stock_balances (store_id, product_id, qty_on_hand)
              VALUES ($1, $2, $3)
              ON CONFLICT (store_id, product_id)
              DO UPDATE SET
                qty_on_hand = stock_balances.qty_on_hand + $3,
                updated_at = NOW()
            `, [store_id, item.product_id, Math.abs(Number(item.qty))]);
          }
        }
      }

      // Remove stock_movements tied to this receipt (both 'sale' and any 'cancelled' reversals)
      await client.query(
        `DELETE FROM stock_movements WHERE store_id = $1 AND reference = $2`,
        [store_id, receipt_no]
      );

      // Delete child records first (FK constraints)
      // Check if restaurant_sale_context exists before deleting (optional table)
      const tableCheck = await client.query(`
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'restaurant_sale_context'
      `);
      if (tableCheck.rows.length > 0) {
        await client.query('DELETE FROM restaurant_sale_context WHERE sale_id = $1', [saleId]);
      }
      await client.query('DELETE FROM sale_items WHERE sale_id = $1', [saleId]);
      await client.query('DELETE FROM sale_payments WHERE sale_id = $1', [saleId]);
      await client.query('DELETE FROM sales WHERE sale_id = $1', [saleId]);

      await client.query('COMMIT');
      logger.info(`Sale ${saleId} permanently deleted`);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw error;
    } finally {
      try { client.release(); } catch (_) {}
    }
  }

  // Get sale by ID - Using subqueries to avoid Cartesian product with payments
  static async findById(saleId: string): Promise<SaleWithDetails | null> {
    const query = `
      SELECT 
        s.*,
        c.full_name as customer_name,
        c.phone as customer_phone,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'sale_item_id', si.sale_item_id,
                'sale_id', si.sale_id,
                'product_id', si.product_id,
                'product_name', p.name,
                'book_id', si.book_id,
                'unit_of_measure', p.unit_of_measure,
                'qty', si.qty,
                'unit_price', si.unit_price,
                'tax_rate', si.tax_rate,
                'line_total', si.line_total
              )
              ORDER BY si.sale_item_id
            )
            FROM sale_items si
            LEFT JOIN products p ON p.product_id = si.product_id
            WHERE si.sale_id = s.sale_id
          ),
          '[]'::json
        ) as items,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'sale_payment_id', sp.sale_payment_id,
                'sale_id', sp.sale_id,
                'method', sp.method,
                'amount', sp.amount
              )
              ORDER BY sp.sale_payment_id
            )
            FROM sale_payments sp
            WHERE sp.sale_id = s.sale_id
          ),
          '[]'::json
        ) as payments
      FROM sales s
      LEFT JOIN customers c ON c.customer_id = s.customer_id
      WHERE s.sale_id = $1
    `;
    const saleResult = await this.query(query, [saleId]);

    if (saleResult.rows.length === 0) {
      return null;
    }

    const sale = saleResult.rows[0];

    return {
      ...sale,
      items: sale.items || [],
      payments: sale.payments || [],
      customer: sale.customer_name ? {
        customer_id: sale.customer_id,
        full_name: sale.customer_name,
        phone: sale.customer_phone,
      } : undefined,
    };
  }

  // Get all sales with filters
  static async findAll(filters: SaleFilters = {}): Promise<PaginatedResult<SaleWithDetails>> {
    const { page, limit, offset } = this.getPaginationParams(filters.page, filters.limit);

    let query = `
      SELECT 
        s.*,
        c.full_name as customer_name,
        c.phone as customer_phone,
        st.name as store_name,
        t.name as terminal_name,
        u.full_name as cashier_name
      FROM sales s
      LEFT JOIN customers c ON c.customer_id = s.customer_id
      LEFT JOIN stores st ON st.store_id = s.store_id
      LEFT JOIN terminals t ON t.terminal_id = s.terminal_id
      LEFT JOIN app_users u ON u.user_id = s.cashier_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (filters.status) {
      paramCount++;
      query += ` AND s.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.customer_id) {
      paramCount++;
      query += ` AND s.customer_id = $${paramCount}`;
      params.push(filters.customer_id);
    }

    if (filters.store_id) {
      paramCount++;
      query += ` AND s.store_id = $${paramCount}`;
      params.push(filters.store_id);
    }

    if (filters.start_date) {
      paramCount++;
      query += ` AND s.created_date >= $${paramCount}`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      paramCount++;
      query += ` AND s.created_date <= $${paramCount}`;
      params.push(filters.end_date);
    }

    if (filters.search) {
      paramCount++;
      query += ` AND (
        s.receipt_no ILIKE $${paramCount} OR
        c.full_name ILIKE $${paramCount} OR
        u.full_name ILIKE $${paramCount}
      )`;
      params.push(`%${filters.search}%`);
    }

    // Get total count
    const countQuery = this.buildCountQuery(query);
    const countResult = await this.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Add pagination
    paramCount++;
    query += ` ORDER BY s.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await this.query(query, params);
    const sales = result.rows;

    // If no sales, return empty result
    if (sales.length === 0) {
      return this.buildPaginatedResult([], total, page, limit);
    }

    // Get all items and payments for all sales in a single query (fixes N+1 problem)
    const saleIds = sales.map((s: any) => s.sale_id);

    const itemsQuery = `
      SELECT 
        si.*, 
        p.name as product_name, 
        p.barcode,
        p.unit_of_measure
      FROM sale_items si
      LEFT JOIN products p ON p.product_id = si.product_id
      WHERE si.sale_id = ANY($1)
      ORDER BY si.sale_id, si.sale_item_id
    `;
    const itemsResult = await this.query(itemsQuery, [saleIds]);

    const paymentsQuery = `
      SELECT 
        sale_payment_id,
        sale_id,
        method,
        amount
      FROM sale_payments
      WHERE sale_id = ANY($1)
      ORDER BY sale_id, sale_payment_id
    `;
    const paymentsResult = await this.query(paymentsQuery, [saleIds]);

    // Group items and payments by sale_id
    const itemsBySale: Record<string, SaleItem[]> = {};
    itemsResult.rows.forEach((item: any) => {
      if (!itemsBySale[item.sale_id]) {
        itemsBySale[item.sale_id] = [];
      }
      itemsBySale[item.sale_id].push({
        sale_item_id: item.sale_item_id,
        sale_id: item.sale_id,
        product_id: item.product_id,
        product_name: item.product_name,
        book_id: item.book_id,
        unit_of_measure: item.unit_of_measure,
        qty: item.qty,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        line_total: item.line_total,
      });
    });

    const paymentsBySale: Record<string, SalePayment[]> = {};
    paymentsResult.rows.forEach((payment: any) => {
      if (!paymentsBySale[payment.sale_id]) {
        paymentsBySale[payment.sale_id] = [];
      }
      paymentsBySale[payment.sale_id].push({
        sale_payment_id: payment.sale_payment_id,
        sale_id: payment.sale_id,
        method: payment.method,
        amount: payment.amount,
      });
    });

    // Combine sales with their items and payments
    const salesWithDetails: SaleWithDetails[] = sales.map((sale: any) => ({
      ...sale,
      items: itemsBySale[sale.sale_id] || [],
      payments: paymentsBySale[sale.sale_id] || [],
      customer: sale.customer_name ? {
        customer_id: sale.customer_id,
        full_name: sale.customer_name,
        phone: sale.customer_phone,
      } : undefined,
      store_name: sale.store_name,
      terminal_name: sale.terminal_name,
      cashier_name: sale.cashier_name,
    }));

    return this.buildPaginatedResult(salesWithDetails, total, page, limit);
  }

}

