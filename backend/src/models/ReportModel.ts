import { BaseModel } from './BaseModel';

export interface SalesSummary {
  date: string;
  total_sales: number;
  total_revenue: number;
  total_tax: number;
  transaction_count: number;
}

export interface ProductSalesReport {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_revenue: number;
  sale_count: number;
}

export interface CustomerSalesReport {
  customer_id: string;
  customer_name: string;
  total_orders: number;
  total_spent: number;
  last_order_date: string;
}

export interface PaymentMethodReport {
  method: string;
  transaction_count: number;
  total_amount: number;
}

export interface PurchaseSummary {
  date: string;
  total_purchases: number;
  total_cost: number;
  po_count: number;
}

export interface SupplierPurchaseReport {
  supplier_id: string;
  supplier_name: string;
  total_orders: number;
  total_cost: number;
  last_order_date: string;
}

export interface StockReport {
  product_id: string;
  product_name: string;
  qty_on_hand: number;
  track_inventory: boolean;
}

export interface LowStockReport {
  product_id: string;
  product_name: string;
  qty_on_hand: number;
  min_threshold?: number;
}

export interface ReportFilters {
  start_date?: string;
  end_date?: string;
  store_id?: string;
  limit?: number;
}

export class ReportModel extends BaseModel {
  // Sales Summary Report
  static async getSalesSummary(filters: ReportFilters = {}): Promise<SalesSummary[]> {
    let query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transaction_count,
        SUM(grand_total) as total_revenue,
        SUM(tax_total) as total_tax,
        COUNT(DISTINCT sale_id) as total_sales
      FROM sales
      WHERE status = 'paid'
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (filters.start_date) {
      paramCount++;
      query += ` AND DATE(created_at) >= $${paramCount}`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      paramCount++;
      query += ` AND DATE(created_at) <= $${paramCount}`;
      params.push(filters.end_date);
    }

    if (filters.store_id) {
      paramCount++;
      query += ` AND store_id = $${paramCount}`;
      params.push(filters.store_id);
    }

    query += ` GROUP BY DATE(created_at) ORDER BY date DESC`;

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
    }

    const result = await this.query<SalesSummary>(query, params);
    return result.rows;
  }

  // Product Sales Report
  static async getProductSales(filters: ReportFilters = {}): Promise<ProductSalesReport[]> {
    let query = `
      SELECT 
        p.product_id,
        p.name as product_name,
        SUM(si.qty) as total_quantity,
        SUM(si.line_total) as total_revenue,
        COUNT(DISTINCT si.sale_id) as sale_count
      FROM sale_items si
      INNER JOIN products p ON p.product_id = si.product_id
      INNER JOIN sales s ON s.sale_id = si.sale_id
      WHERE s.status = 'paid'
    `;
    const params: any[] = [];
    let paramCount = 0;

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

    if (filters.store_id) {
      paramCount++;
      query += ` AND s.store_id = $${paramCount}`;
      params.push(filters.store_id);
    }

    query += ` 
      GROUP BY p.product_id, p.name
      ORDER BY total_revenue DESC
    `;

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
    }

    const result = await this.query<ProductSalesReport>(query, params);
    return result.rows;
  }

  // Customer Sales Report
  static async getCustomerSales(filters: ReportFilters = {}): Promise<CustomerSalesReport[]> {
    let query = `
      SELECT 
        c.customer_id,
        c.full_name as customer_name,
        COUNT(DISTINCT s.sale_id) as total_orders,
        SUM(s.grand_total) as total_spent,
        MAX(s.created_at) as last_order_date
      FROM sales s
      INNER JOIN customers c ON c.customer_id = s.customer_id
      WHERE s.status = 'paid'
    `;
    const params: any[] = [];
    let paramCount = 0;

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

    if (filters.store_id) {
      paramCount++;
      query += ` AND s.store_id = $${paramCount}`;
      params.push(filters.store_id);
    }

    query += ` 
      GROUP BY c.customer_id, c.full_name
      ORDER BY total_spent DESC
    `;

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
    }

    const result = await this.query<CustomerSalesReport>(query, params);
    return result.rows;
  }

  // Payment Method Report
  static async getPaymentMethodReport(filters: ReportFilters = {}): Promise<PaymentMethodReport[]> {
    let query = `
      SELECT 
        sp.method,
        COUNT(DISTINCT sp.sale_id) as transaction_count,
        SUM(sp.amount) as total_amount
      FROM sale_payments sp
      INNER JOIN sales s ON s.sale_id = sp.sale_id
      WHERE s.status = 'paid'
    `;
    const params: any[] = [];
    let paramCount = 0;

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

    if (filters.store_id) {
      paramCount++;
      query += ` AND s.store_id = $${paramCount}`;
      params.push(filters.store_id);
    }

    query += ` 
      GROUP BY sp.method
      ORDER BY total_amount DESC
    `;

    const result = await this.query<PaymentMethodReport>(query, params);
    return result.rows;
  }

  // Purchase Summary Report
  static async getPurchaseSummary(filters: ReportFilters = {}): Promise<PurchaseSummary[]> {
    let query = `
      SELECT 
        DATE(po.ordered_at) as date,
        COUNT(DISTINCT po.po_id) as po_count,
        COALESCE(SUM(poi.qty_ordered * poi.unit_cost), 0) as total_cost,
        COUNT(DISTINCT po.po_id) as total_purchases
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.po_id
      WHERE po.status = 'RECEIVED'
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (filters.start_date) {
      paramCount++;
      query += ` AND DATE(po.ordered_at) >= $${paramCount}`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      paramCount++;
      query += ` AND DATE(po.ordered_at) <= $${paramCount}`;
      params.push(filters.end_date);
    }

    if (filters.store_id) {
      paramCount++;
      query += ` AND po.store_id = $${paramCount}`;
      params.push(filters.store_id);
    }

    query += ` GROUP BY DATE(po.ordered_at) ORDER BY date DESC`;

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
    }

    const result = await this.query<PurchaseSummary>(query, params);
    return result.rows;
  }

  // Supplier Purchase Report
  static async getSupplierPurchases(filters: ReportFilters = {}): Promise<SupplierPurchaseReport[]> {
    let query = `
      SELECT 
        s.supplier_id,
        s.name as supplier_name,
        COUNT(DISTINCT po.po_id) as total_orders,
        SUM(poi.qty_ordered * poi.unit_cost) as total_cost,
        MAX(po.ordered_at) as last_order_date
      FROM purchase_orders po
      INNER JOIN suppliers s ON s.supplier_id = po.supplier_id
      INNER JOIN purchase_order_items poi ON poi.po_id = po.po_id
      WHERE po.status = 'RECEIVED'
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (filters.start_date) {
      paramCount++;
      query += ` AND DATE(po.ordered_at) >= $${paramCount}`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      paramCount++;
      query += ` AND DATE(po.ordered_at) <= $${paramCount}`;
      params.push(filters.end_date);
    }

    if (filters.store_id) {
      paramCount++;
      query += ` AND po.store_id = $${paramCount}`;
      params.push(filters.store_id);
    }

    query += ` 
      GROUP BY s.supplier_id, s.name
      ORDER BY total_cost DESC
    `;

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
    }

    const result = await this.query<SupplierPurchaseReport>(query, params);
    return result.rows;
  }

  // Stock Report
  static async getStockReport(storeId?: string): Promise<StockReport[]> {
    let query = `
      SELECT 
        p.product_id,
        p.name as product_name,
        COALESCE(sb.qty_on_hand, 0) as qty_on_hand,
        p.track_inventory
      FROM products p
      LEFT JOIN stock_balances sb ON sb.product_id = p.product_id
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (storeId) {
      paramCount++;
      query += ` WHERE sb.store_id = $${paramCount} OR sb.store_id IS NULL`;
      params.push(storeId);
    }

    query += ` ORDER BY p.name`;

    const result = await this.query<StockReport>(query, params);
    return result.rows;
  }

  // Low Stock Report
  static async getLowStockReport(storeId?: string, threshold: number = 10): Promise<LowStockReport[]> {
    let query = `
      SELECT 
        p.product_id,
        p.name as product_name,
        COALESCE(sb.qty_on_hand, 0) as qty_on_hand,
        ${threshold} as min_threshold
      FROM products p
      LEFT JOIN stock_balances sb ON sb.product_id = p.product_id
      WHERE p.track_inventory = true
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (storeId) {
      paramCount++;
      query += ` AND (sb.store_id = $${paramCount} OR sb.store_id IS NULL)`;
      params.push(storeId);
    }

    query += ` 
      AND COALESCE(sb.qty_on_hand, 0) <= $${paramCount + 1}
      ORDER BY qty_on_hand ASC
    `;
    params.push(threshold);

    const result = await this.query<LowStockReport>(query, params);
    return result.rows;
  }
}

