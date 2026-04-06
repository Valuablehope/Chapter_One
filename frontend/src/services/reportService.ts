import api from './api';

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

export interface ProfitReport {
  total_sales: number;
  total_cogs: number;
  total_profit: number;
}

export interface ReportFilters {
  start_date?: string;
  end_date?: string;
  store_id?: string;
  limit?: number;
  threshold?: number;
}

export const reportService = {
  // Sales Reports
  async getSalesSummary(filters: ReportFilters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.store_id) params.append('store_id', filters.store_id);
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<{ success: boolean; data: SalesSummary[] }>(
      `/reports/sales/summary?${params.toString()}`
    );
    return response.data.data;
  },

  async getProductSales(filters: ReportFilters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.store_id) params.append('store_id', filters.store_id);
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<{ success: boolean; data: ProductSalesReport[] }>(
      `/reports/sales/products?${params.toString()}`
    );
    return response.data.data;
  },

  async getCustomerSales(filters: ReportFilters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.store_id) params.append('store_id', filters.store_id);
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<{ success: boolean; data: CustomerSalesReport[] }>(
      `/reports/sales/customers?${params.toString()}`
    );
    return response.data.data;
  },

  async getPaymentMethodReport(filters: ReportFilters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.store_id) params.append('store_id', filters.store_id);

    const response = await api.get<{ success: boolean; data: PaymentMethodReport[] }>(
      `/reports/sales/payment-methods?${params.toString()}`
    );
    return response.data.data;
  },

  async getProfitReport(filters: ReportFilters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.store_id) params.append('store_id', filters.store_id);
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<{ success: boolean; data: ProfitReport }>(
      `/reports/profit?${params.toString()}`
    );
    return response.data.data;
  },

  // Purchase Reports
  async getPurchaseSummary(filters: ReportFilters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.store_id) params.append('store_id', filters.store_id);
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<{ success: boolean; data: PurchaseSummary[] }>(
      `/reports/purchases/summary?${params.toString()}`
    );
    return response.data.data;
  },

  async getSupplierPurchases(filters: ReportFilters = {}) {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.store_id) params.append('store_id', filters.store_id);
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<{ success: boolean; data: SupplierPurchaseReport[] }>(
      `/reports/purchases/suppliers?${params.toString()}`
    );
    return response.data.data;
  },

  // Inventory Reports
  async getStockReport(storeId?: string) {
    const params = new URLSearchParams();
    if (storeId) params.append('store_id', storeId);

    const response = await api.get<{ success: boolean; data: StockReport[] }>(
      `/reports/inventory/stock?${params.toString()}`
    );
    return response.data.data;
  },

  async getLowStockReport(storeId?: string, threshold: number = 10) {
    const params = new URLSearchParams();
    if (storeId) params.append('store_id', storeId);
    params.append('threshold', threshold.toString());

    const response = await api.get<{ success: boolean; data: LowStockReport[] }>(
      `/reports/inventory/low-stock?${params.toString()}`
    );
    return response.data.data;
  },
};











