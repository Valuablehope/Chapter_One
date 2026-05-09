import api from './api';

export interface OpeningStockItem {
  item_id: string;
  session_id: string;
  product_id: string;
  qty: number;
  product_name?: string;
  sku?: string;
  barcode?: string;
}

export interface OpeningStockSession {
  session_id: string;
  store_id: string;
  reference: string;
  notes?: string;
  status: 'draft' | 'committed';
  committed_at?: string;
  committed_by?: string;
  created_at: string;
  created_by?: string;
  items: OpeningStockItem[];
}

export interface SaveOpeningStockPayload {
  notes?: string;
  items: { product_id: string; qty: number }[];
}

export const openingStockService = {
  async getSession(): Promise<OpeningStockSession | null> {
    const response = await api.get<{ success: boolean; data: OpeningStockSession | null }>(
      '/opening-stock'
    );
    return response.data.data;
  },

  async saveDraft(payload: SaveOpeningStockPayload): Promise<OpeningStockSession> {
    const response = await api.post<{ success: boolean; data: OpeningStockSession }>(
      '/opening-stock',
      payload
    );
    return response.data.data;
  },

  async commit(sessionId: string): Promise<OpeningStockSession> {
    const response = await api.post<{ success: boolean; data: OpeningStockSession }>(
      '/opening-stock/commit',
      { session_id: sessionId }
    );
    return response.data.data;
  },

  async reset(sessionId: string): Promise<void> {
    await api.delete(`/opening-stock/${sessionId}`);
  },
};
