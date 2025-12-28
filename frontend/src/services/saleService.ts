import api from './api';
import { Product } from './productService';

export type PaymentMethod = 'cash' | 'card' | 'voucher' | 'other';

export interface CartItem {
  product: Product;
  qty: number;
  unit_price: number;
  tax_rate?: number;
  line_total: number;
}

export interface SalePayment {
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
}

export interface SaleItem {
  sale_item_id: string;
  sale_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
}

export const saleService = {
  // Create sale
  async createSale(data: CreateSaleData): Promise<Sale> {
    const response = await api.post<{ success: boolean; data: Sale }>(
      '/sales',
      data
    );
    return response.data.data;
  },

  // Get sale by ID
  async getSaleById(id: string): Promise<Sale> {
    const response = await api.get<{ success: boolean; data: Sale }>(
      `/sales/${id}`
    );
    return response.data.data;
  },
};











