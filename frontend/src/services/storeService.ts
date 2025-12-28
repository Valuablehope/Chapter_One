import api from './api';

export interface StoreSettings {
  store_id: string;
  code: string;
  name: string;
  address?: string;
  currency_code?: string;
  tax_inclusive?: boolean;
  theme?: string;
  timezone?: string;
  tax_rate?: number | null;
  receipt_footer?: string | null;
  receipt_header?: string | null;
  auto_backup?: boolean;
  backup_frequency?: string;
  low_stock_threshold?: number;
  show_stock?: boolean;
  auto_add_qty?: boolean;
  allow_negative?: boolean;
  paper_size?: string;
  auto_print?: boolean;
}

export const storeService = {
  async getStoreSettings(storeId: string): Promise<StoreSettings> {
    const response = await api.get<{ success: boolean; data: StoreSettings }>(
      `/admin/stores/${storeId}`
    );
    return response.data.data;
  },
};

