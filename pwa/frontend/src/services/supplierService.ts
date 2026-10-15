import api from './api';

/**
 * Supplier service for managing supplier-related API calls
 * Handles CRUD operations for suppliers with pagination and search
 */
export interface Supplier {
  supplier_id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierFilters {
  search?: string;
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

export const supplierService = {
  // Get all suppliers with filters
  async getSuppliers(filters: SupplierFilters = {}, signal?: AbortSignal): Promise<PaginatedResponse<Supplier>> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<PaginatedResponse<Supplier>>(
      `/suppliers?${params.toString()}`,
      { signal }
    );
    return response.data;
  },

  // Get supplier by ID
  async getSupplierById(id: string): Promise<Supplier> {
    const response = await api.get<{ success: boolean; data: Supplier }>(
      `/suppliers/${id}`
    );
    return response.data.data;
  },

  // Create supplier
  async createSupplier(supplier: Partial<Supplier>): Promise<Supplier> {
    const response = await api.post<{ success: boolean; data: Supplier }>(
      '/suppliers',
      supplier
    );
    return response.data.data;
  },

  // Update supplier
  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    const response = await api.put<{ success: boolean; data: Supplier }>(
      `/suppliers/${id}`,
      updates
    );
    return response.data.data;
  },

  // Delete supplier
  async deleteSupplier(id: string): Promise<void> {
    await api.delete(`/suppliers/${id}`);
  },
};

