import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  getCategories,
  createCategory,
  deleteCategory,
  getExpenses,
  createExpense,
  deleteExpense,
} from '../controllers/expensesController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─── Categories ──────────────────────────────────────────────────────────────

router.get('/categories', getCategories);

router.post(
  '/categories',
  authorize('admin', 'manager'),
  [body('name').trim().notEmpty().withMessage('Category name is required').isLength({ max: 100 })],
  validateRequest,
  createCategory
);

router.delete(
  '/categories/:id',
  authorize('admin'),
  [param('id').isInt({ min: 1 }).withMessage('Invalid category id')],
  validateRequest,
  deleteCategory
);

// ─── Expenses ─────────────────────────────────────────────────────────────────

router.get(
  '/',
  [
    query('date').optional().isDate().withMessage('date must be YYYY-MM-DD'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  validateRequest,
  getExpenses
);

router.post(
  '/',
  [
    body('category_id').isInt({ min: 1 }).withMessage('category_id is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('amount must be a positive number'),
    body('description').optional().isString().isLength({ max: 500 }),
    body('expense_date').optional().isDate().withMessage('expense_date must be YYYY-MM-DD'),
  ],
  validateRequest,
  createExpense
);

router.delete(
  '/:id',
  authorize('admin', 'manager'),
  [param('id').isUUID().withMessage('Invalid expense id')],
  validateRequest,
  deleteExpense
);

export default router;
