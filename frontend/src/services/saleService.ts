import api from './api';
import { Product } from './productService';
import { offlineQueue } from './offlineQueue';
import { logger } from '../utils/logger';

/**
 * Custom error for offline operations
 */
export class OfflineError extends Error {
  constructor(
    message: string,
    public queueId: string
  ) {
    super(message);
    this.name = 'OfflineError';
  }
}

/**
 * Check if an error is a network error (offline)
 */
function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  // Network errors
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return true;
  if (error.message?.includes('Network Error')) return true;
  if (error.message?.includes('Failed to fetch')) return true;
  
  // No response from server (offline)
  if (!error.response && error.request) return true;
  
  return false;
}

export type PaymentMethod = 'cash' | 'card' | 'voucher' | 'other';

export interface CartItem {
  product: Product;
  qty: number;
  unit_price: number;
  tax_rate?: number;
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
  payments: SalePayment[];
}

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
  status: string;
  created_at: string;
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
  status?: 'open' | 'paid' | 'void';
  customer_id?: string;
  store_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface SaleItem {
  sale_item_id: string;
  sale_id: string;
  product_id: string;
  product_name?: string;
  qty: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
}

export const saleService = {
  // Get all sales with filters
  async getSales(filters: SaleFilters = {}): Promise<{ data: Sale[]; pagination: any }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    
    const response = await api.get<{ success: boolean; data: Sale[]; pagination: any }>(
      `/sales?${params.toString()}`
    );
    return {
      data: response.data.data,
      pagination: response.data.pagination,
    };
  },

  /**
   * Generate a unique client-side sale ID (UUID v4)
   */
  generateClientSaleId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  // Create sale with offline queue support
  async createSale(data: CreateSaleData, clientSaleId?: string): Promise<Sale> {
    // Generate client sale ID if not provided
    const saleId = clientSaleId || data.client_sale_id || this.generateClientSaleId();
    
    // Include client sale ID in request
    const saleDataWithId = {
      ...data,
      client_sale_id: saleId,
    };

    try {
      const response = await api.post<{ success: boolean; data: Sale }>(
        '/sales',
        saleDataWithId
      );
      return response.data.data;
    } catch (error: any) {
      // If network error, queue for offline sync with client sale ID
      if (isNetworkError(error)) {
        logger.warn('Network error detected, queueing sale for offline sync', error);
        const queueId = await offlineQueue.enqueueSale(data, saleId);
        throw new OfflineError('Sale queued for offline sync. It will be synced when connection is restored.', queueId);
      }
      // Re-throw other errors
      throw error;
    }
  },

  // Get sale by ID
  async getSaleById(id: string): Promise<Sale> {
    const response = await api.get<{ success: boolean; data: Sale }>(
      `/sales/${id}`
    );
    return response.data.data;
  },
};











