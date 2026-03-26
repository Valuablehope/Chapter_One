import api from './api';

/**
 * Product service for managing product-related API calls
 * Handles CRUD operations for products with pagination and filtering
 */
export interface Product {
  product_id: string;
  sku?: string;
  barcode?: string;
  name: string;
  product_type: string;
  unit_of_measure: string;
  list_price?: number;
  sale_price?: number;
  tax_rate?: number;
  track_inventory: boolean;
  created_at: string;
  updated_at: string;
  qty_in?: number;      // Sum of purchases
  qty_out?: number;     // Sum of sales
  balance?: number;     // qty_in - qty_out
}

export interface ProductFilters {
  search?: string;
  product_type?: string;
  track_inventory?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateProductData {
  sku?: string;
  barcode?: string;
  name: string;
  product_type?: string;
  unit_of_measure?: string;
  list_price?: number;
  sale_price?: number;
  tax_rate?: number;
  track_inventory?: boolean;
}

export interface UpdateProductData extends Partial<CreateProductData> {}

export const productService = {
  // Get all products with filters
  async getProducts(filters: ProductFilters = {}, signal?: AbortSignal): Promise<PaginatedResponse<Product>> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.product_type) params.append('product_type', filters.product_type);
    if (filters.track_inventory !== undefined) {
      params.append('track_inventory', filters.track_inventory.toString());
    }
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<PaginatedResponse<Product>>(
      `/products?${params.toString()}`,
      { signal }
    );
    return response.data;
  },

  // Get product by ID
  async getProductById(id: string): Promise<Product> {
    const response = await api.get<{ success: boolean; data: Product }>(
      `/products/${id}`
    );
    return response.data.data;
  },

  // Get product by barcode
  async getProductByBarcode(barcode: string): Promise<Product> {
    const response = await api.get<{ success: boolean; data: Product }>(
      `/products/barcode/${barcode}`
    );
    return response.data.data;
  },

  // Create product
  async createProduct(data: CreateProductData): Promise<Product> {
    const response = await api.post<{ success: boolean; data: Product }>(
      '/products',
      data
    );
    return response.data.data;
  },

  // Update product
  async updateProduct(id: string, data: UpdateProductData): Promise<Product> {
    const response = await api.put<{ success: boolean; data: Product }>(
      `/products/${id}`,
      data
    );
    return response.data.data;
  },

  // Delete product
  async deleteProduct(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },

  // Validate barcode
  async validateBarcode(barcode: string, excludeProductId?: string): Promise<boolean> {
    const response = await api.post<{ success: boolean; data: { valid: boolean } }>(
      '/products/validate-barcode',
      { barcode, excludeProductId }
    );
    return response.data.data.valid;
  },
};









