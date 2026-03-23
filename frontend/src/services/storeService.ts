import api from './api';
import type { PosModuleType } from './adminService';

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
  pos_module_type?: PosModuleType;
  restaurant_table_count?: number | null;
  restaurant_track_guests_per_table?: boolean;
}

type StoreModuleChangeListener = () => void;
const storeModuleChangeListeners = new Set<StoreModuleChangeListener>();

export const storeService = {
  async getStoreSettings(storeId: string): Promise<StoreSettings> {
    // Use public endpoint (accessible to all authenticated users)
    const response = await api.get<{ success: boolean; data: StoreSettings }>(
      `/stores/${storeId}/settings`
    );
    return response.data.data;
  },
  
  async getDefaultStore(): Promise<StoreSettings> {
    // Get default active store (accessible to all authenticated users)
    const response = await api.get<{ success: boolean; data: StoreSettings }>(
      `/stores/default`
    );
    return response.data.data;
  },

  notifyStoreModuleChanged(): void {
    storeModuleChangeListeners.forEach((listener) => listener());
  },

  subscribeStoreModuleChanged(listener: StoreModuleChangeListener): () => void {
    storeModuleChangeListeners.add(listener);
    return () => {
      storeModuleChangeListeners.delete(listener);
    };
  },
};

