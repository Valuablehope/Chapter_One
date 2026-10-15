import api from './api';
import { ScaleLineInfo } from './productService';

/**
 * Digital scale (label-printing scale) integration service.
 * Devices are LAN scales the POS pushes PLU data to; barcode formats describe
 * the price/weight-embedded labels the scales print so any scanned label can
 * be decoded regardless of scale brand.
 */

export interface ScaleDevice {
  scale_id: string;
  name: string;
  brand: string;
  driver: 'generic_tcp' | 'csv_export';
  host?: string | null;
  port?: number | null;
  department?: number | null;
  options: Record<string, any>;
  is_active: boolean;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  last_sync_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScaleBarcodeFormat {
  format_id: string;
  name: string;
  prefixes: string;
  plu_length: number;
  value_length: number;
  value_type: 'price' | 'weight' | 'quantity' | 'none';
  value_divisor: number;
  check_digit: 'none' | 'ean13';
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface ScaleBrandPreset {
  key: string;
  label: string;
  driver: 'generic_tcp' | 'csv_export';
  default_port?: number;
  default_options?: Record<string, any>;
  notes: string;
}

export interface ScalePluProduct {
  product_id: string;
  plu_code: number;
  name: string;
  sale_price: number;
  list_price: number;
  unit_of_measure: string;
  tax_rate: number;
}

export interface ScaleTestParseResult {
  matched: boolean;
  active_formats?: number;
  parsed?: {
    format_id: string;
    format_name: string;
    prefix: string;
    plu_code: number;
    value: number | null;
    value_type: string;
    checksum_valid: boolean | null;
  };
  product?: { product_id: string; name: string; sale_price: number } | null;
  line?: ScaleLineInfo | null;
}

export interface ScaleSyncResult {
  success: boolean;
  message: string;
  sent: number;
  payload?: string;
  filename?: string;
}

export type CreateScaleDeviceData = Partial<
  Omit<ScaleDevice, 'scale_id' | 'created_at' | 'updated_at' | 'last_sync_at' | 'last_sync_status' | 'last_sync_message'>
> & { name: string };

export type CreateScaleFormatData = Omit<
  ScaleBarcodeFormat,
  'format_id' | 'created_at' | 'updated_at' | 'is_active' | 'priority'
> & { is_active?: boolean; priority?: number };

export const scaleService = {
  // ---------- Devices ----------

  async getDevices(): Promise<ScaleDevice[]> {
    const response = await api.get<{ success: boolean; data: ScaleDevice[] }>('/scales/devices');
    return response.data.data;
  },

  async createDevice(data: CreateScaleDeviceData): Promise<ScaleDevice> {
    const response = await api.post<{ success: boolean; data: ScaleDevice }>(
      '/scales/devices',
      data
    );
    return response.data.data;
  },

  async updateDevice(scaleId: string, data: Partial<CreateScaleDeviceData>): Promise<ScaleDevice> {
    const response = await api.put<{ success: boolean; data: ScaleDevice }>(
      `/scales/devices/${scaleId}`,
      data
    );
    return response.data.data;
  },

  async deleteDevice(scaleId: string): Promise<void> {
    await api.delete(`/scales/devices/${scaleId}`);
  },

  async testDevice(scaleId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; data: { success: boolean; message: string } }>(
      `/scales/devices/${scaleId}/test`
    );
    return response.data.data;
  },

  async syncDevice(scaleId: string): Promise<ScaleSyncResult> {
    const response = await api.post<{ success: boolean; data: ScaleSyncResult }>(
      `/scales/devices/${scaleId}/sync`
    );
    return response.data.data;
  },

  async getPresets(): Promise<ScaleBrandPreset[]> {
    const response = await api.get<{ success: boolean; data: ScaleBrandPreset[] }>(
      '/scales/presets'
    );
    return response.data.data;
  },

  // ---------- Barcode formats ----------

  async getFormats(): Promise<ScaleBarcodeFormat[]> {
    const response = await api.get<{ success: boolean; data: ScaleBarcodeFormat[] }>(
      '/scales/formats'
    );
    return response.data.data;
  },

  async createFormat(data: CreateScaleFormatData): Promise<ScaleBarcodeFormat> {
    const response = await api.post<{ success: boolean; data: ScaleBarcodeFormat }>(
      '/scales/formats',
      data
    );
    return response.data.data;
  },

  async updateFormat(
    formatId: string,
    data: Partial<CreateScaleFormatData>
  ): Promise<ScaleBarcodeFormat> {
    const response = await api.put<{ success: boolean; data: ScaleBarcodeFormat }>(
      `/scales/formats/${formatId}`,
      data
    );
    return response.data.data;
  },

  async deleteFormat(formatId: string): Promise<void> {
    await api.delete(`/scales/formats/${formatId}`);
  },

  // ---------- Utilities ----------

  async testParse(barcode: string): Promise<ScaleTestParseResult> {
    const response = await api.post<{ success: boolean; data: ScaleTestParseResult }>(
      '/scales/parse',
      { barcode }
    );
    return response.data.data;
  },

  async getPluProducts(): Promise<ScalePluProduct[]> {
    const response = await api.get<{ success: boolean; data: ScalePluProduct[] }>(
      '/scales/plu-products'
    );
    return response.data.data;
  },

  async exportPluCsv(): Promise<Blob> {
    const response = await api.get('/scales/export/csv', { responseType: 'blob' });
    return response.data as Blob;
  },
};
