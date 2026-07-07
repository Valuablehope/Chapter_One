import api from './api';

/**
 * Product service for managing product-related API calls
 * Handles CRUD operations for products with pagination and filtering
 */
export interface Product {
  product_id: string;
  sku?: string;
  barcode?: string;
  plu_code?: number | null;
  name: string;
  product_type: string;
  unit_of_measure: string;
  list_price?: number;
  sale_price?: number;
  margin_pct?: number;
  tax_rate?: number;
  track_inventory: boolean;
  image_url?: string;
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
  pos_category_only?: boolean;
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
  plu_code?: number | null;
  name: string;
  product_type?: string;
  unit_of_measure?: string;
  list_price?: number;
  sale_price?: number;
  margin_pct?: number;
  tax_rate?: number;
  track_inventory?: boolean;
  image_url?: string;
}

export interface UpdateProductData extends Partial<CreateProductData> {}

/** How the POS should turn a decoded scale label into a sale line. */
export interface ScaleLineInfo {
  plu_code: number;
  format_name: string;
  value_type: 'price' | 'weight' | 'quantity' | 'none';
  qty: number;
  line_total: number | null;
  unit_price: number;
}

export const productService = {
  // Get all products with filters
  async getProducts(filters: ProductFilters = {}, signal?: AbortSignal): Promise<PaginatedResponse<Product>> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.product_type) params.append('product_type', filters.product_type);
    if (filters.track_inventory !== undefined) {
      params.append('track_inventory', filters.track_inventory.toString());
    }
    if (filters.pos_category_only) {
      params.append('pos_category_only', 'true');
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

  // Barcode lookup that also decodes scale labels (price/weight-embedded barcodes).
  // `scale` is present when the barcode was a label printed by a digital scale.
  async lookupBarcode(barcode: string): Promise<{ product: Product; scale?: ScaleLineInfo }> {
    const response = await api.get<{ success: boolean; data: Product; scale?: ScaleLineInfo }>(
      `/products/barcode/${encodeURIComponent(barcode)}`
    );
    return { product: response.data.data, scale: response.data.scale };
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

  // Bulk import products from parsed CSV/XLSX data
  async bulkImport(products: CreateProductData[]): Promise<{ created: number; skipped: number; errors: string[] }> {
    const response = await api.post<{ success: boolean; data: { created: number; skipped: number; errors: string[] } }>(
      '/products/bulk-import',
      { products }
    );
    return response.data.data;
  },
 
  // Upload product image
  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post<{ success: boolean; data: { url: string } }>(
      '/products/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data.url;
  },
};









