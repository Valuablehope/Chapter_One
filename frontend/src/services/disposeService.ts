import api from './api';

export interface DisposeReason {
  reason_id: number;
  store_id: string | null;
  name: string;
  is_system: boolean;
  sort_order: number;
}

export interface DisposalItem {
  disposal_item_id: string;
  disposal_id: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  reason_id: number;
  reason_name?: string;
  qty: number;
  unit_cost: number;
  value_lost: number;
  note: string | null;
}

export interface Disposal {
  disposal_id: string;
  store_id: string;
  notes: string | null;
  total_qty: number;
  total_value_lost: number;
  disposed_by: string | null;
  disposed_by_name?: string;
  disposed_at: string;
  created_at: string;
  item_count?: number;
  items?: DisposalItem[];
}

export interface CreateDisposalItemPayload {
  product_id: string;
  qty: number;
  reason_id: number;
  note?: string;
}

export interface CreateDisposalPayload {
  items: CreateDisposalItemPayload[];
  notes?: string;
}

export const disposeService = {
  // Reasons
  async getReasons(): Promise<DisposeReason[]> {
    const res = await api.get<{ success: boolean; data: DisposeReason[] }>('/dispose/reasons');
    return res.data.data;
  },

  async createReason(name: string): Promise<DisposeReason> {
    const res = await api.post<{ success: boolean; data: DisposeReason }>('/dispose/reasons', { name });
    return res.data.data;
  },

  async deleteReason(reasonId: number): Promise<void> {
    await api.delete(`/dispose/reasons/${reasonId}`);
  },

  // Disposals
  async getDisposals(date?: string, page = 1, limit = 20): Promise<{
    data: Disposal[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params: Record<string, string | number> = { page, limit };
    if (date) params.date = date;
    const res = await api.get('/dispose', { params });
    return res.data as any;
  },

  async getDisposalById(id: string): Promise<Disposal> {
    const res = await api.get<{ success: boolean; data: Disposal }>(`/dispose/${id}`);
    return res.data.data;
  },

  async createDisposal(payload: CreateDisposalPayload): Promise<Disposal> {
    const res = await api.post<{ success: boolean; data: Disposal }>('/dispose', payload);
    return res.data.data;
  },

  async deleteDisposal(id: string): Promise<void> {
    await api.delete(`/dispose/${id}`);
  },
};
