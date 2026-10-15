// Shared types between frontend and backend

export interface User {
  user_id: string;
  username: string;
  full_name: string;
  role: 'cashier' | 'manager' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface Store {
  store_id: string;
  code: string;
  name: string;
  address?: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  product_id: string;
  sku?: string;
  barcode?: string;
  name: string;
  product_type: string;
  list_price?: number;
  sale_price?: number;
  tax_rate?: number;
  track_inventory: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}











