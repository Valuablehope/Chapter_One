import { BaseModel, PaginatedResult } from './BaseModel';

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

// Reporting safeguards constants
const MAX_REPORT_LIMIT = 10000;
const MAX_DATE_RANGE_DAYS = 365;
const DEFAULT_REPORT_LIMIT = 1000;

export class ReportModel extends BaseModel {
  /**
   * Validate and sanitize report filters
   * Enforces maximum limits and date ranges to prevent memory exhaustion
   */
  private static validateReportFilters(filters: ReportFilters): ReportFilters {
    const validated = { ...filters };

    // Enforce maximum limit
    if (validated.limit && validated.limit > MAX_REPORT_LIMIT) {
      throw new Error(`Limit cannot exceed ${MAX_REPORT_LIMIT} records. Please use pagination for larger datasets.`);
    }

    // Set default limit if not specified
    if (!validated.limit) {
      validated.limit = DEFAULT_REPORT_LIMIT;
    }

    // Validate date range
    if (validated.start_date && validated.end_date) {
      const startDate = new Date(validated.start_date);
      const endDate = new Date(validated.end_date);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format. Use YYYY-MM-DD format.');
      }

      if (startDate > endDate) {
        throw new Error('Start date cannot be after end date.');
      }

      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff > MAX_DATE_RANGE_DAYS) {
        throw new Error(
          `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days (${Math.ceil(MAX_DATE_RANGE_DAYS / 30)} months). ` +
          `Please use a smaller date range or use pagination.`
        );
      }
    }

    return validated;
  }

  // Sales Summary Report
  static async getSalesSummary(filters: ReportFilters = {}): Promise<SalesSummary[]> {
    const validatedFilters = this.validateReportFilters(filters);
    let query = `
      SELECT 
        created_date as date,
        COUNT(*) as transaction_count,
        SUM(grand_total) as total_revenue,
        SUM(tax_total) as total_tax,
        COUNT(DISTINCT sale_id) as total_sales
      FROM sales
      WHERE status = 'paid'
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (validatedFilters.start_date) {
      paramCount++;
      query += ` AND created_date >= $${paramCount}`;
      params.push(validatedFilters.start_date);
    }

    if (validatedFilters.end_date) {
      paramCount++;
      query += ` AND created_date <= $${paramCount}`;
      params.push(validatedFilters.end_date);
    }

    if (validatedFilters.store_id) {
      paramCount++;
      query += ` AND store_id = $${paramCount}`;
      params.push(validatedFilters.store_id);
    }

    query += ` GROUP BY created_date ORDER BY date DESC`;

    // Always apply limit (default or specified)
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(validatedFilters.limit);

    // Apply 60-second timeout for report queries
    const result = await this.query<SalesSummary>(query, params, 60000);
    return result.rows;
  }

  // Product Sales Report
  static async getProductSales(filters: ReportFilters = {}): Promise<ProductSalesReport[]> {
    const validatedFilters = this.validateReportFilters(filters);
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

    if (validatedFilters.start_date) {
      paramCount++;
      query += ` AND s.created_date >= $${paramCount}`;
      params.push(validatedFilters.start_date);
    }

    if (validatedFilters.end_date) {
      paramCount++;
      query += ` AND s.created_date <= $${paramCount}`;
      params.push(validatedFilters.end_date);
    }

    if (validatedFilters.store_id) {
      paramCount++;
      query += ` AND s.store_id = $${paramCount}`;
      params.push(validatedFilters.store_id);
    }

    query += ` 
      GROUP BY p.product_id, p.name
      ORDER BY total_revenue DESC
    `;

    // Always apply limit (default or specified)
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(validatedFilters.limit);

    // Apply 60-second timeout for report queries
    const result = await this.query<ProductSalesReport>(query, params, 60000);
    return result.rows;
  }

  // Customer Sales Report
  static async getCustomerSales(filters: ReportFilters = {}): Promise<CustomerSalesReport[]> {
    const validatedFilters = this.validateReportFilters(filters);
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

    if (validatedFilters.start_date) {
      paramCount++;
      query += ` AND s.created_date >= $${paramCount}`;
      params.push(validatedFilters.start_date);
    }

    if (validatedFilters.end_date) {
      paramCount++;
      query += ` AND s.created_date <= $${paramCount}`;
      params.push(validatedFilters.end_date);
    }

    if (validatedFilters.store_id) {
      paramCount++;
      query += ` AND s.store_id = $${paramCount}`;
      params.push(validatedFilters.store_id);
    }

    query += ` 
      GROUP BY c.customer_id, c.full_name
      ORDER BY total_spent DESC
    `;

    // Always apply limit (default or specified)
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(validatedFilters.limit);

    // Apply 60-second timeout for report queries
    const result = await this.query<CustomerSalesReport>(query, params, 60000);
    return result.rows;
  }

  // Payment Method Report
  static async getPaymentMethodReport(filters: ReportFilters = {}): Promise<PaymentMethodReport[]> {
    const validatedFilters = this.validateReportFilters(filters);
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

    if (validatedFilters.start_date) {
      paramCount++;
      query += ` AND s.created_date >= $${paramCount}`;
      params.push(validatedFilters.start_date);
    }

    if (validatedFilters.end_date) {
      paramCount++;
      query += ` AND s.created_date <= $${paramCount}`;
      params.push(validatedFilters.end_date);
    }

    if (validatedFilters.store_id) {
      paramCount++;
      query += ` AND s.store_id = $${paramCount}`;
      params.push(validatedFilters.store_id);
    }

    query += ` 
      GROUP BY sp.method
      ORDER BY total_amount DESC
    `;

    // Apply 60-second timeout for report queries
    const result = await this.query<PaymentMethodReport>(query, params, 60000);
    return result.rows;
  }

  // Purchase Summary Report
  static async getPurchaseSummary(filters: ReportFilters = {}): Promise<PurchaseSummary[]> {
    const validatedFilters = this.validateReportFilters(filters);
    let query = `
      SELECT 
        po.ordered_date as date,
        COUNT(DISTINCT po.po_id) as po_count,
        COALESCE(SUM(poi.qty_ordered * poi.unit_cost), 0) as total_cost,
        COUNT(DISTINCT po.po_id) as total_purchases
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.po_id
      WHERE po.status = 'RECEIVED'
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (validatedFilters.start_date) {
      paramCount++;
      query += ` AND po.ordered_date >= $${paramCount}`;
      params.push(validatedFilters.start_date);
    }

    if (validatedFilters.end_date) {
      paramCount++;
      query += ` AND po.ordered_date <= $${paramCount}`;
      params.push(validatedFilters.end_date);
    }

    if (validatedFilters.store_id) {
      paramCount++;
      query += ` AND po.store_id = $${paramCount}`;
      params.push(validatedFilters.store_id);
    }

    query += ` GROUP BY po.ordered_date ORDER BY date DESC`;

    // Always apply limit (default or specified)
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(validatedFilters.limit);

    // Apply 60-second timeout for report queries
    const result = await this.query<PurchaseSummary>(query, params, 60000);
    return result.rows;
  }

  // Supplier Purchase Report
  static async getSupplierPurchases(filters: ReportFilters = {}): Promise<SupplierPurchaseReport[]> {
    const validatedFilters = this.validateReportFilters(filters);
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

    if (validatedFilters.start_date) {
      paramCount++;
      query += ` AND po.ordered_date >= $${paramCount}`;
      params.push(validatedFilters.start_date);
    }

    if (validatedFilters.end_date) {
      paramCount++;
      query += ` AND po.ordered_date <= $${paramCount}`;
      params.push(validatedFilters.end_date);
    }

    if (validatedFilters.store_id) {
      paramCount++;
      query += ` AND po.store_id = $${paramCount}`;
      params.push(validatedFilters.store_id);
    }

    query += ` 
      GROUP BY s.supplier_id, s.name
      ORDER BY total_cost DESC
    `;

    // Always apply limit (default or specified)
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(validatedFilters.limit);

    // Apply 60-second timeout for report queries
    const result = await this.query<SupplierPurchaseReport>(query, params, 60000);
    return result.rows;
  }

  // Stock Report with pagination
  static async getStockReport(
    storeId?: string,
    page?: number,
    limit?: number
  ): Promise<PaginatedResult<StockReport>> {
    const { page: pageNum, limit: limitNum, offset } = this.getPaginationParams(page, limit || 1000);
    
    // Enforce max limit
    const maxLimit = 1000;
    const actualLimit = Math.min(limitNum, maxLimit);
    
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

    // Get total count
    const countQuery = this.buildCountQuery(query);
    const countResult = await this.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Add pagination
    query += ` ORDER BY p.name`;
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(actualLimit);
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    // Apply 60-second timeout for report queries
    const result = await this.query<StockReport>(query, params, 60000);
    return this.buildPaginatedResult(result.rows, total, pageNum, actualLimit);
  }

  // Low Stock Report with pagination
  static async getLowStockReport(
    storeId?: string,
    threshold: number = 10,
    page?: number,
    limit?: number
  ): Promise<PaginatedResult<LowStockReport>> {
    const { page: pageNum, limit: limitNum, offset } = this.getPaginationParams(page, limit || 1000);
    
    // Enforce max limit
    const maxLimit = 1000;
    const actualLimit = Math.min(limitNum, maxLimit);
    
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

    paramCount++;
    query += ` AND COALESCE(sb.qty_on_hand, 0) <= $${paramCount}`;
    params.push(threshold);

    // Get total count
    const countQuery = this.buildCountQuery(query);
    const countResult = await this.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Add pagination
    query += ` ORDER BY qty_on_hand ASC`;
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(actualLimit);
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    // Apply 60-second timeout for report queries
    const result = await this.query<LowStockReport>(query, params, 60000);
    return this.buildPaginatedResult(result.rows, total, pageNum, actualLimit);
  }
}

