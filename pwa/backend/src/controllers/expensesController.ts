import { Request, Response, NextFunction } from 'express';
import { ExpensesModel } from '../models/ExpensesModel';
import { DayClosureModel } from '../models/DayClosureModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';

// ─── Categories ──────────────────────────────────────────────────────────────

export const getCategories = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const storeId = await DayClosureModel.resolveStoreId();
    const categories = await ExpensesModel.getCategories(storeId);
    res.status(200).json({ success: true, data: categories });
  }
);

export const createCategory = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { name } = req.body;
    if (!name?.trim()) throw new CustomError('Category name is required', 400);

    const storeId = await DayClosureModel.resolveStoreId();
    const category = await ExpensesModel.createCategory(storeId, name);
    res.status(201).json({ success: true, data: category });
  }
);

export const deleteCategory = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const storeId = await DayClosureModel.resolveStoreId();
    await ExpensesModel.deleteCategory(Number(id), storeId);
    res.status(200).json({ success: true, message: 'Category deleted' });
  }
);

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const getExpenses = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const date = req.query.date as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const storeId = await DayClosureModel.resolveStoreId();
    const result = await ExpensesModel.getExpenses(storeId, date, page, limit);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  }
);

export const createExpense = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { category_id, amount, description, expense_date } = req.body;
    const userId = req.user?.userId;

    if (!category_id) throw new CustomError('category_id is required', 400);
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new CustomError('amount must be a positive number', 400);
    }

    const storeId = await DayClosureModel.resolveStoreId();
    const expense = await ExpensesModel.createExpense({
      store_id: storeId,
      category_id: Number(category_id),
      amount: Number(amount),
      description,
      expense_date,
      created_by: userId,
    });

    res.status(201).json({ success: true, data: expense });
  }
);

export const deleteExpense = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const storeId = await DayClosureModel.resolveStoreId();
    await ExpensesModel.deleteExpense(id, storeId);
    res.status(200).json({ success: true, message: 'Expense deleted' });
  }
);
