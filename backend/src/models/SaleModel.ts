import { BaseModel, PaginatedResult } from './BaseModel';
import { pool } from '../config/database';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';
import { cache } from '../utils/cache';

export type SaleStatus = 'open' | 'paid' | 'void';
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
  grand_total: number;
  paid_total: number;
  status: SaleStatus;
  created_at: string;
}

export interface SaleItem {
  sale_item_id: string;
  sale_id: string;
  product_id: string;
  product_name?: string;
  book_id?: string;
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
      ORDER BY created_at ASC
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

  // Create sale with SERIALIZABLE isolation and retry logic
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
          // Set SERIALIZABLE isolation level to prevent race conditions
          await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

      // Check for duplicate sale (idempotency check) if client_sale_id is provided
      if (data.client_sale_id) {
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
      }

      // Get store and terminal
      const store = await this.getDefaultStore();
      if (!store) {
        throw new Error('No active store found');
      }

      const terminal = await this.getDefaultTerminal(store.store_id);
      if (!terminal) {
        throw new Error('No active terminal found for store');
      }

      // Generate receipt number (within transaction for atomicity)
      const receiptNo = await this.generateReceiptNo(store.store_id, client);

      // Calculate totals
      let subtotal = 0;
      let taxTotal = 0;

      for (const item of data.items) {
        const lineTotal = item.qty * item.unit_price;
        subtotal += lineTotal;
        const taxRate = item.tax_rate || 0;
        taxTotal += lineTotal * (taxRate / 100);
      }

      const discountTotal = 0; // Can be added later
      const grandTotal = subtotal + taxTotal - discountTotal;
      const paidTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);

      if (paidTotal < grandTotal) {
        throw new Error('Payment amount is less than grand total');
      }

      // Create sale
      const saleQuery = `
        INSERT INTO sales (
          store_id, terminal_id, cashier_id, customer_id,
          receipt_no, subtotal, tax_total, discount_total,
          grand_total, paid_total, status, client_sale_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      const saleValues = [
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
        data.client_sale_id || null,
      ];
      const saleResult = await client.query(saleQuery, saleValues);
      const sale = saleResult.rows[0];

      // Create sale items
      const items: SaleItem[] = [];
      for (const item of data.items) {
        const taxRate = item.tax_rate || 0;
        const lineTotal = item.qty * item.unit_price * (1 + taxRate / 100);
        
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
          item.unit_price,
          taxRate,
          lineTotal,
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
          
          // Validate stock availability
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
      query += ` AND DATE(s.created_at) >= $${paramCount}`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      paramCount++;
      query += ` AND DATE(s.created_at) <= $${paramCount}`;
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
        p.barcode
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

