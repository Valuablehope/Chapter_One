import api from './api';

export interface DayClosurePreview {
  store_id: string;
  store_name: string | null;
  total_sales: number;
  total_transactions: number;
  gross_cash: number;
  cash_refunds_out: number;
  cash_expected: number;
  card_total: number;
  other_payments: number;
  voucher_total: number;
  total_expenses: number;
  currency_code: string;
  lbp_exchange_rate: number | null;
  opening_float: number;
  opening_float_breakdown: Record<string, number> | null;
  previous_z_number: number | null;
  previous_closed_at: string | null;
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
  cash_breakdown: any | null;
  total_expenses: number;
  opening_float: number;
  opening_float_breakdown: Record<string, number> | null;
  cash_left_in_drawer: number;
  cash_left_in_drawer_breakdown: Record<string, number> | null;
  cash_to_bank: number;
  created_at: string;
}

export interface CloseDayClosureParams {
  cashActual: number;
  notes?: string;
  cashBreakdown?: Record<string, number>;
  cashLeftInDrawer?: number;
  cashLeftInDrawerBreakdown?: Record<string, number>;
  openingFloat?: number;
  openingFloatBreakdown?: Record<string, number> | null;
  storeId?: string;
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

  async close(params: CloseDayClosureParams): Promise<DayClosureRecord> {
    const {
      cashActual,
      notes,
      cashBreakdown,
      cashLeftInDrawer,
      cashLeftInDrawerBreakdown,
      openingFloat,
      openingFloatBreakdown,
      storeId,
    } = params;
    const queryParams = storeId ? { store_id: storeId } : {};
    const res = await api.post<{ success: boolean; data: DayClosureRecord }>(
      '/day-closure/close',
      {
        cash_actual: cashActual,
        notes: notes || undefined,
        cash_breakdown: cashBreakdown,
        cash_left_in_drawer: cashLeftInDrawer ?? 0,
        cash_left_in_drawer_breakdown: cashLeftInDrawerBreakdown,
        opening_float: openingFloat ?? undefined,
        opening_float_breakdown: openingFloatBreakdown ?? undefined,
      },
      { params: queryParams }
    );
    return res.data.data;
  },
};
