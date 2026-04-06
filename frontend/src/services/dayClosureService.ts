import api from './api';

export interface DayClosurePreview {
  store_id: string;
  store_name: string | null;
  total_sales: number;
  total_transactions: number;
  cash_expected: number;
  card_total: number;
  other_payments: number;
  voucher_total: number;
}

export interface DayClosureRecord {
  id: number;
  store_id: string;
  closure_date: string;
  total_sales: number;
  total_transactions: number;
  cash_expected: number;
  cash_actual: number | null;
  cash_difference: number | null;
  card_total: number;
  other_payments: number;
  closed_by: string;
  closed_at: string;
  z_number: number;
  notes: string | null;
  created_at: string;
}

export const dayClosureService = {
  async getPreview(storeId?: string): Promise<DayClosurePreview> {
    const params = storeId ? { store_id: storeId } : {};
    const res = await api.get<{ success: boolean; data: DayClosurePreview }>(
      '/day-closure/preview',
      { params }
    );
    return res.data.data;
  },

  async close(cashActual: number, notes: string | undefined, storeId?: string): Promise<DayClosureRecord> {
    const params = storeId ? { store_id: storeId } : {};
    const res = await api.post<{ success: boolean; data: DayClosureRecord }>(
      '/day-closure/close',
      { cash_actual: cashActual, notes: notes || undefined },
      { params }
    );
    return res.data.data;
  },
};
