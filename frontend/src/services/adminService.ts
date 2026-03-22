import api from './api';

export type PosModuleType = 'store' | 'retail_store' | 'restaurant';

export interface RestaurantMenuItem {
  name: string;
  price: number;
}

export interface RestaurantMenuCategory {
  name: string;
  items: RestaurantMenuItem[];
}

export interface RestaurantMenu {
  name: string;
  categories: RestaurantMenuCategory[];
}

export interface AppUser {
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
  is_active: boolean;
  created_at: string;
  timezone?: string; // From stores table
  // Store Settings Fields (from store_settings table)
  currency_code?: string;
  tax_inclusive?: boolean;
  theme?: string;
  tax_rate?: number | null;
  receipt_footer?: string | null;
  auto_backup?: boolean;
  backup_frequency?: string;
  low_stock_threshold?: number;
  show_stock?: boolean;
  auto_add_qty?: boolean;
  allow_negative?: boolean;
  paper_size?: string;
  auto_print?: boolean;
  receipt_header?: string;
  pos_module_type?: PosModuleType;
  restaurant_table_count?: number | null;
  restaurant_track_guests_per_table?: boolean;
  restaurant_menus?: RestaurantMenu[];
}

export interface Terminal {
  terminal_id: string;
  store_id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

export const adminService = {
  // User Management
  async getUsers(filters: {
    search?: string;
    role?: 'cashier' | 'manager' | 'admin';
    is_active?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<PaginatedResponse<AppUser>> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.role) params.append('role', filters.role);
    if (filters.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<PaginatedResponse<AppUser>>(
      `/admin/users?${params.toString()}`
    );
    return response.data;
  },

  async getUserById(id: string): Promise<AppUser> {
    const response = await api.get<{ success: boolean; data: AppUser }>(`/admin/users/${id}`);
    return response.data.data;
  },

  async createUser(user: {
    username: string;
    full_name: string;
    password: string;
    role?: 'cashier' | 'manager' | 'admin';
    is_active?: boolean;
  }): Promise<AppUser> {
    const response = await api.post<{ success: boolean; data: AppUser }>('/admin/users', user);
    return response.data.data;
  },

  async updateUser(id: string, updates: {
    full_name?: string;
    role?: 'cashier' | 'manager' | 'admin';
    password?: string;
    is_active?: boolean;
  }): Promise<AppUser> {
    const response = await api.put<{ success: boolean; data: AppUser }>(`/admin/users/${id}`, updates);
    return response.data.data;
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/admin/users/${id}`);
  },

  // Store Management
  async getStores(filters: {
    search?: string;
    is_active?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<PaginatedResponse<Store>> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<PaginatedResponse<Store>>(
      `/admin/stores?${params.toString()}`
    );
    return response.data;
  },

  async getStoreById(id: string): Promise<Store> {
    const response = await api.get<{ success: boolean; data: Store }>(`/admin/stores/${id}`);
    return response.data.data;
  },

  async createStore(store: Partial<Store> & {
    code: string;
    name: string;
  }): Promise<Store> {
    const response = await api.post<{ success: boolean; data: Store }>('/admin/stores', store);
    return response.data.data;
  },

  async updateStore(id: string, updates: Partial<Store>): Promise<Store> {
    const response = await api.put<{ success: boolean; data: Store }>(`/admin/stores/${id}`, updates);
    return response.data.data;
  },

  async deleteStore(id: string): Promise<void> {
    await api.delete(`/admin/stores/${id}`);
  },

  // Terminal Management
  async getTerminals(filters: {
    store_id?: string;
    search?: string;
    is_active?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<PaginatedResponse<Terminal>> {
    const params = new URLSearchParams();
    if (filters.store_id) params.append('store_id', filters.store_id);
    if (filters.search) params.append('search', filters.search);
    if (filters.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<PaginatedResponse<Terminal>>(
      `/admin/terminals?${params.toString()}`
    );
    return response.data;
  },

  async getTerminalById(id: string): Promise<Terminal> {
    const response = await api.get<{ success: boolean; data: Terminal }>(`/admin/terminals/${id}`);
    return response.data.data;
  },

  async createTerminal(terminal: {
    store_id: string;
    code: string;
    name: string;
    is_active?: boolean;
  }): Promise<Terminal> {
    const response = await api.post<{ success: boolean; data: Terminal }>('/admin/terminals', terminal);
    return response.data.data;
  },

  async updateTerminal(id: string, updates: Partial<Terminal>): Promise<Terminal> {
    const response = await api.put<{ success: boolean; data: Terminal }>(`/admin/terminals/${id}`, updates);
    return response.data.data;
  },

  async deleteTerminal(id: string): Promise<void> {
    await api.delete(`/admin/terminals/${id}`);
  },
};




