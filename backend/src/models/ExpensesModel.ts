import { BaseModel } from './BaseModel';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

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

export interface CreateExpenseData {
  store_id: string;
  category_id: number;
  amount: number;
  description?: string;
  expense_date?: string;
  created_by?: string;
}

export class ExpensesModel extends BaseModel {

  // ── Categories ────────────────────────────────────────────────────────────

  static async getCategories(storeId: string): Promise<ExpenseCategory[]> {
    const result = await this.query<ExpenseCategory>(
      `SELECT category_id, store_id, name, is_system, sort_order
       FROM expense_categories
       WHERE store_id IS NULL OR store_id = $1
       ORDER BY sort_order ASC, name ASC`,
      [storeId]
    );
    return result.rows;
  }

  static async createCategory(storeId: string, name: string): Promise<ExpenseCategory> {
    const result = await this.query<ExpenseCategory>(
      `INSERT INTO expense_categories (store_id, name, is_system, sort_order)
       VALUES ($1, $2, false, 100)
       RETURNING *`,
      [storeId, name.trim()]
    );
    return result.rows[0];
  }

  static async deleteCategory(categoryId: number, storeId: string): Promise<void> {
    // Only allow deleting custom (non-system) categories belonging to this store
    const result = await this.query(
      `DELETE FROM expense_categories
       WHERE category_id = $1 AND store_id = $2 AND is_system = false`,
      [categoryId, storeId]
    );
    if ((result.rowCount ?? 0) === 0) {
      throw new Error('Category not found or cannot be deleted');
    }
  }

  // ── Expenses ──────────────────────────────────────────────────────────────

  static async getExpenses(
    storeId: string,
    date?: string,
    page = 1,
    limit = 50
  ): Promise<{ data: Expense[]; total: number }> {
    const offset = (page - 1) * limit;
    const params: any[] = [storeId];
    let filter = '';
    if (date) {
      params.push(date);
      filter = `AND e.expense_date = $${params.length}`;
    }

    const countResult = await this.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count
       FROM expenses e
       WHERE e.store_id = $1 ${filter}`,
      params
    );

    params.push(limit, offset);
    const result = await this.query<Expense>(
      `SELECT e.*, ec.name AS category_name
       FROM expenses e
       JOIN expense_categories ec ON ec.category_id = e.category_id
       WHERE e.store_id = $1 ${filter}
       ORDER BY e.expense_date DESC, e.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return { data: result.rows, total: Number(countResult.rows[0].count) };
  }

  static async createExpense(data: CreateExpenseData): Promise<Expense> {
    const result = await this.query<Expense>(
      `INSERT INTO expenses (store_id, category_id, amount, description, expense_date, created_by)
       VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6)
       RETURNING *`,
      [
        data.store_id,
        data.category_id,
        data.amount,
        data.description?.trim() || null,
        data.expense_date || null,
        data.created_by || null,
      ]
    );

    // Fetch with category name
    const withCat = await this.query<Expense>(
      `SELECT e.*, ec.name AS category_name
       FROM expenses e
       JOIN expense_categories ec ON ec.category_id = e.category_id
       WHERE e.expense_id = $1`,
      [result.rows[0].expense_id]
    );
    return withCat.rows[0];
  }

  static async deleteExpense(expenseId: string, storeId: string): Promise<void> {
    const result = await this.query(
      `DELETE FROM expenses
       WHERE expense_id = $1 AND store_id = $2 AND day_closure_id IS NULL`,
      [expenseId, storeId]
    );
    if ((result.rowCount ?? 0) === 0) {
      throw new Error('Expense not found, already closed, or not owned by this store');
    }
  }

  /** Sum of all unclosed expenses for the store — used by day closure preview */
  static async getUnclosedTotal(storeId: string): Promise<number> {
    const result = await this.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM expenses
       WHERE store_id = $1 AND day_closure_id IS NULL`,
      [storeId]
    );
    return Math.round(Number(result.rows[0].total) * 100) / 100;
  }

  /** Called inside day closure transaction to lock expenses to a closure */
  static async attachToClosureClient(
    client: { query: Function },
    storeId: string,
    closureId: number
  ): Promise<number> {
    const result = await client.query(
      `UPDATE expenses
       SET day_closure_id = $1
       WHERE store_id = $2 AND day_closure_id IS NULL
       RETURNING expense_id`,
      [closureId, storeId]
    );
    const count = result.rowCount ?? 0;
    if (count > 0) {
      logger.info(`[DayClosure] Attached ${count} expense(s) to closure ${closureId}`);
    }
    return count;
  }
}
