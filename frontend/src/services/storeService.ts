import api from './api';
import type { PosModuleType } from './adminService';

export interface StoreSettings {
  store_id: string;
  code: string;
  name: string;
  address?: string;
  phone?: string | null;
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
  lbp_exchange_rate?: number | null;
  label_show_lbp?: boolean;
  label_store_name_size?: number | null;
  label_product_name_size?: number | null;
  label_lbp_size?: number | null;
  label_price_size?: number | null;
  label_header_align?: string | null;
  label_header_font_weight?: number | null;
  label_title_align?: string | null;
  label_title_font_weight?: number | null;
  label_lbp_row_align?: string | null;
  label_lbp_prefix_size?: number | null;
  label_lbp_prefix_weight?: number | null;
  label_lbp_amount_weight?: number | null;
  label_price_row_align?: string | null;
  label_currency_size?: number | null;
  label_currency_weight?: number | null;
  label_price_amount_weight?: number | null;
  /** Permutation of shelf label blocks: header, title, lbp, price */
  label_section_order?: unknown;
}

/** Payload for PATCH /stores/:id/label-layout */
export type LabelLayoutPatch = Pick<
  StoreSettings,
  | 'label_show_lbp'
  | 'label_store_name_size'
  | 'label_product_name_size'
  | 'label_lbp_size'
  | 'label_price_size'
  | 'label_header_align'
  | 'label_header_font_weight'
  | 'label_title_align'
  | 'label_title_font_weight'
  | 'label_lbp_row_align'
  | 'label_lbp_prefix_size'
  | 'label_lbp_prefix_weight'
  | 'label_lbp_amount_weight'
  | 'label_price_row_align'
  | 'label_currency_size'
  | 'label_currency_weight'
  | 'label_price_amount_weight'
  | 'label_section_order'
>;

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

  async patchLabelLayout(storeId: string, payload: Partial<LabelLayoutPatch>): Promise<StoreSettings> {
    const response = await api.patch<{ success: boolean; data: StoreSettings }>(
      `/stores/${storeId}/label-layout`,
      payload
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

