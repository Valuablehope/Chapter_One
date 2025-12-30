import { BaseModel, PaginatedResult } from './BaseModel';
import { pool } from '../config/database';

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
  static async getDefaultStore(): Promise<{ store_id: string; code: string; name: string } | null> {
    const query = `
      SELECT store_id, code, name
      FROM stores
      WHERE is_active = true
      ORDER BY created_at ASC
      LIMIT 1
    `;
    const result = await this.query(query);
    return result.rows[0] || null;
  }

  // Get default terminal for store
  static async getDefaultTerminal(storeId: string): Promise<{ terminal_id: string; code: string; name: string } | null> {
    const query = `
      SELECT terminal_id, code, name
      FROM terminals
      WHERE store_id = $1 AND is_active = true
      ORDER BY created_at ASC
      LIMIT 1
    `;
    const result = await this.query(query, [storeId]);
    return result.rows[0] || null;
  }

  // Generate receipt number
  static async generateReceiptNo(storeId: string): Promise<string> {
    const query = `
      SELECT COUNT(*) as count
      FROM sales
      WHERE store_id = $1 AND DATE(created_at) = CURRENT_DATE
    `;
    const result = await this.query(query, [storeId]);
    const count = parseInt(result.rows[0].count, 10);
    
    // Format: YYYYMMDD-XXXX (e.g., 20231205-0001)
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const sequence = String(count + 1).padStart(4, '0');
    return `${date}-${sequence}`;
  }

  // Create sale
  static async create(
    cashierId: string,
    data: CreateSaleData
  ): Promise<SaleWithDetails> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get store and terminal
      const store = await this.getDefaultStore();
      if (!store) {
        throw new Error('No active store found');
      }

      const terminal = await this.getDefaultTerminal(store.store_id);
      if (!terminal) {
        throw new Error('No active terminal found for store');
      }

      // Generate receipt number
      const receiptNo = await this.generateReceiptNo(store.store_id);

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
          grand_total, paid_total, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        const productQuery = `
          SELECT track_inventory FROM products WHERE product_id = $1
        `;
        const productResult = await client.query(productQuery, [item.product_id]);
        if (productResult.rows[0]?.track_inventory) {
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
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
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

