import api from './api';

/**
 * Customer service for managing customer-related API calls
 * Handles CRUD operations for customers with pagination and search
 */
export interface Customer {
  customer_id: string;
  full_name?: string;
  phone?: string;
  email?: string;
  created_at: string;
  updated_at: string;
  total_orders?: number;
  total_spent?: number;
  last_order?: string;
  notes?: string;
}

export interface CustomerFilters {
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

export const customerService = {
  // Get all customers with filters
  async getCustomers(filters: CustomerFilters = {}, signal?: AbortSignal): Promise<PaginatedResponse<Customer>> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<PaginatedResponse<Customer>>(
      `/customers?${params.toString()}`,
      { signal }
    );
    return response.data;
  },

  // Get customer by ID
  async getCustomerById(id: string): Promise<Customer> {
    const response = await api.get<{ success: boolean; data: Customer }>(
      `/customers/${id}`
    );
    return response.data.data;
  },

  // Create customer
  async createCustomer(customer: Partial<Customer>): Promise<Customer> {
    const response = await api.post<{ success: boolean; data: Customer }>(
      '/customers',
      customer
    );
    return response.data.data;
  },

  // Update customer
  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const response = await api.put<{ success: boolean; data: Customer }>(
      `/customers/${id}`,
      updates
    );
    return response.data.data;
  },

  // Delete customer
  async deleteCustomer(id: string): Promise<void> {
    await api.delete(`/customers/${id}`);
  },
};

