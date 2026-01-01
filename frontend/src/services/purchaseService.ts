import api from './api';

export type PurchaseOrderStatus = 'OPEN' | 'PENDING' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  po_item_id: string;
  po_id: string;
  product_id: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
  product_name?: string;
  barcode?: string;
}

export interface PurchaseOrder {
  po_id: string;
  supplier_id: string;
  store_id: string;
  po_number: string;
  status: PurchaseOrderStatus;
  ordered_at: string;
  expected_at?: string;
  received_at?: string;
  items: PurchaseOrderItem[];
  supplier?: {
    supplier_id: string;
    name: string;
    contact_name?: string;
    phone?: string;
  };
  total_cost: number;
}

export interface CreatePurchaseOrderData {
  supplier_id: string;
  expected_at?: string;
  items: {
    product_id: string;
    qty_ordered: number;
    unit_cost: number;
  }[];
}

export interface UpdatePurchaseOrderData {
  supplier_id?: string;
  expected_at?: string;
  items?: {
    product_id: string;
    qty_ordered: number;
    unit_cost: number;
  }[];
}

export interface PurchaseOrderFilters {
  supplier_id?: string;
  status?: PurchaseOrderStatus;
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

export const purchaseService = {
  // Get all purchase orders with filters
  async getPurchaseOrders(filters: PurchaseOrderFilters = {}): Promise<PaginatedResponse<PurchaseOrder>> {
    const params = new URLSearchParams();
    if (filters.supplier_id) params.append('supplier_id', filters.supplier_id);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<PaginatedResponse<PurchaseOrder>>(
      `/purchases?${params.toString()}`
    );
    return response.data;
  },

  // Get purchase order by ID
  async getPurchaseOrderById(id: string): Promise<PurchaseOrder> {
    const response = await api.get<{ success: boolean; data: PurchaseOrder }>(
      `/purchases/${id}`
    );
    return response.data.data;
  },

  // Create purchase order
  async createPurchaseOrder(data: CreatePurchaseOrderData): Promise<PurchaseOrder> {
    const response = await api.post<{ success: boolean; data: PurchaseOrder }>(
      '/purchases',
      data
    );
    return response.data.data;
  },

  // Update purchase order
  async updatePurchaseOrder(id: string, data: UpdatePurchaseOrderData): Promise<PurchaseOrder> {
    const response = await api.put<{ success: boolean; data: PurchaseOrder }>(
      `/purchases/${id}`,
      data
    );
    return response.data.data;
  },

  // Update purchase order status
  async updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus): Promise<PurchaseOrder> {
    const response = await api.patch<{ success: boolean; data: PurchaseOrder }>(
      `/purchases/${id}/status`,
      { status }
    );
    return response.data.data;
  },

  // Receive purchase order
  async receivePurchaseOrder(id: string): Promise<PurchaseOrder> {
    const response = await api.post<{ success: boolean; data: PurchaseOrder }>(
      `/purchases/${id}/receive`
    );
    return response.data.data;
  },

  // Delete purchase order
  async deletePurchaseOrder(id: string): Promise<void> {
    await api.delete(`/purchases/${id}`);
  },
};

