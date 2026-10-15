import api from './api';

export interface ExpenseCategory {
  category_id: number;
  store_id: string | null;
  name: string;
  is_system: boolean;
  sort_order: number;
}

export interface Expense {
  expense_id: string;
  store_id: string;
  category_id: number;
  category_name?: string;
  amount: number;
  description?: string;
  expense_date: string;
  day_closure_id: number | null;
  created_by?: string;
  created_at: string;
}

export interface CreateExpensePayload {
  category_id: number;
  amount: number;
  description?: string;
  expense_date?: string;
}

export const expenseService = {
  // Categories
  async getCategories(): Promise<ExpenseCategory[]> {
    const res = await api.get<{ success: boolean; data: ExpenseCategory[] }>('/expenses/categories');
    return res.data.data;
  },

  async createCategory(name: string): Promise<ExpenseCategory> {
    const res = await api.post<{ success: boolean; data: ExpenseCategory }>(
      '/expenses/categories',
      { name }
    );
    return res.data.data;
  },

  async deleteCategory(categoryId: number): Promise<void> {
    await api.delete(`/expenses/categories/${categoryId}`);
  },

  // Expenses
  async getExpenses(date?: string, page = 1, limit = 50): Promise<{
    data: Expense[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params: Record<string, string | number> = { page, limit };
    if (date) params.date = date;
    const res = await api.get('/expenses', { params });
    return res.data as any;
  },

  async createExpense(payload: CreateExpensePayload): Promise<Expense> {
    const res = await api.post<{ success: boolean; data: Expense }>('/expenses', payload);
    return res.data.data;
  },

  async deleteExpense(expenseId: string): Promise<void> {
    await api.delete(`/expenses/${expenseId}`);
  },
};
