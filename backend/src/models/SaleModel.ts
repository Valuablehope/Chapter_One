import { BaseModel } from './BaseModel';
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

  // Get sale by ID - Optimized to use single query with JSON aggregation
  static async findById(saleId: string): Promise<SaleWithDetails | null> {
    const query = `
      SELECT 
        s.*,
        c.full_name as customer_name,
        c.phone as customer_phone,
        COALESCE(
          json_agg(
            json_build_object(
              'sale_item_id', si.sale_item_id,
              'sale_id', si.sale_id,
              'product_id', si.product_id,
              'book_id', si.book_id,
              'qty', si.qty,
              'unit_price', si.unit_price,
              'tax_rate', si.tax_rate,
              'discount', si.discount,
              'line_total', si.line_total,
              'created_at', si.created_at
            )
            ORDER BY si.created_at
          ) FILTER (WHERE si.sale_item_id IS NOT NULL),
          '[]'::json
        ) as items,
        COALESCE(
          json_agg(
            json_build_object(
              'payment_id', sp.payment_id,
              'sale_id', sp.sale_id,
              'payment_method', sp.payment_method,
              'amount', sp.amount,
              'created_at', sp.created_at
            )
            ORDER BY sp.created_at
          ) FILTER (WHERE sp.payment_id IS NOT NULL),
          '[]'::json
        ) as payments
      FROM sales s
      LEFT JOIN customers c ON c.customer_id = s.customer_id
      LEFT JOIN sale_items si ON si.sale_id = s.sale_id
      LEFT JOIN sale_payments sp ON sp.sale_id = s.sale_id
      WHERE s.sale_id = $1
      GROUP BY s.sale_id, c.full_name, c.phone
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

}

