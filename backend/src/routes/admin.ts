import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/userController';
import {
  getStores,
  getStoreById,
  createStore,
  updateStore,
  deleteStore,
} from '../controllers/storeController';
import {
  getTerminals,
  getTerminalById,
  createTerminal,
  updateTerminal,
  deleteTerminal,
} from '../controllers/terminalController';
import { authenticate, authorize } from '../middleware/auth';
import { checkRecordLimit } from '../middleware/licenseCheck';
import { body, query, param } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// User Management Routes
router.get(
  '/users',
  [
    query('search').optional().isString(),
    query('role').optional().isIn(['cashier', 'manager', 'admin']),
    query('is_active').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  getUsers
);

router.get(
  '/users/:id',
  [param('id').isUUID()],
  validateRequest,
  getUserById
);

router.post(
  '/users',
  checkRecordLimit('users'),
  [
    body('username').trim().notEmpty().isLength({ min: 3, max: 50 }),
    body('full_name').trim().notEmpty(),
    body('password').isLength({ min: 6 }),
    body('role').optional().isIn(['cashier', 'manager', 'admin']),
    body('is_active').optional().isBoolean(),
  ],
  validateRequest,
  createUser
);

router.put(
  '/users/:id',
  [
    param('id').isUUID(),
    body('full_name').optional().trim().notEmpty(),
    body('role').optional().isIn(['cashier', 'manager', 'admin']),
    body('password').optional().isLength({ min: 6 }),
    body('is_active').optional().isBoolean(),
  ],
  validateRequest,
  updateUser
);

router.delete(
  '/users/:id',
  [param('id').isUUID()],
  validateRequest,
  deleteUser
);

// Store Management Routes
router.get(
  '/stores',
  [
    query('search').optional().isString(),
    query('is_active').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  getStores
);

router.get(
  '/stores/:id',
  [param('id').isUUID()],
  validateRequest,
  getStoreById
);

router.post(
  '/stores',
  [
    body('code').trim().notEmpty(),
    body('name').trim().notEmpty(),
    body('address').optional({ nullable: true, checkFalsy: true }).isString(),
    body('timezone').optional({ nullable: true, checkFalsy: true }).isString(),
    body('is_active').optional().isBoolean(),
    // Store Settings validation
    body('currency_code').optional({ nullable: true, checkFalsy: true }).custom((value) => {
      if (!value || value === '') return true;
      return typeof value === 'string' && value.length >= 3 && value.length <= 3;
    }).withMessage('Currency code must be 3 characters'),
    body('tax_inclusive').optional().isBoolean(),
    body('theme').optional({ nullable: true, checkFalsy: true }).isString(),
    body('tax_rate').optional({ nullable: true, checkFalsy: true }).custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0 && num <= 100;
    }).withMessage('Tax rate must be a number between 0 and 100'),
    body('receipt_footer').optional({ nullable: true, checkFalsy: true }).isString(),
    body('auto_backup').optional().isBoolean(),
    body('backup_frequency').optional({ nullable: true, checkFalsy: true }).isIn(['daily', 'weekly', 'monthly']),
    body('low_stock_threshold').optional().isInt({ min: 0 }),
    body('show_stock').optional().isBoolean(),
    body('auto_add_qty').optional().isBoolean(),
    body('allow_negative').optional().isBoolean(),
    body('paper_size').optional({ nullable: true, checkFalsy: true }).isString(),
    body('auto_print').optional().isBoolean(),
    body('receipt_header').optional({ nullable: true, checkFalsy: true }).isString(),
    body('pos_module_type').optional().isIn(['store', 'retail_store', 'restaurant']),
    body('restaurant_table_count')
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null || value === undefined) return true;
        const n = typeof value === 'number' ? value : parseInt(String(value), 10);
        return Number.isInteger(n) && n >= 1;
      })
      .withMessage('restaurant_table_count must be a positive integer'),
    body('restaurant_track_guests_per_table').optional().isBoolean(),
    body('lbp_exchange_rate').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }).withMessage('LBP exchange rate must be a non-negative number'),
  ],
  validateRequest,
  createStore
);

router.put(
  '/stores/:id',
  [
    param('id').isUUID(),
    body('code').optional().trim().notEmpty(),
    body('name').optional().trim().notEmpty(),
    body('address').optional({ nullable: true, checkFalsy: true }).isString(),
    body('timezone').optional({ nullable: true, checkFalsy: true }).isString(),
    body('is_active').optional().isBoolean(),
    // Store Settings validation
    body('currency_code').optional({ nullable: true, checkFalsy: true }).custom((value) => {
      if (!value || value === '') return true;
      return typeof value === 'string' && value.length >= 3 && value.length <= 3;
    }).withMessage('Currency code must be 3 characters'),
    body('tax_inclusive').optional().isBoolean(),
    body('theme').optional({ nullable: true, checkFalsy: true }).isString(),
    body('tax_rate').optional({ nullable: true, checkFalsy: true }).custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0 && num <= 100;
    }).withMessage('Tax rate must be a number between 0 and 100'),
    body('receipt_footer').optional({ nullable: true, checkFalsy: true }).isString(),
    body('auto_backup').optional().isBoolean(),
    body('backup_frequency').optional({ nullable: true, checkFalsy: true }).isIn(['daily', 'weekly', 'monthly']),
    body('low_stock_threshold').optional().isInt({ min: 0 }),
    body('show_stock').optional().isBoolean(),
    body('auto_add_qty').optional().isBoolean(),
    body('allow_negative').optional().isBoolean(),
    body('paper_size').optional({ nullable: true, checkFalsy: true }).isString(),
    body('auto_print').optional().isBoolean(),
    body('receipt_header').optional({ nullable: true, checkFalsy: true }).isString(),
    body('pos_module_type').optional().isIn(['store', 'retail_store', 'restaurant']),
    body('restaurant_table_count')
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null || value === undefined) return true;
        const n = typeof value === 'number' ? value : parseInt(String(value), 10);
        return Number.isInteger(n) && n >= 1;
      })
      .withMessage('restaurant_table_count must be a positive integer'),
    body('restaurant_track_guests_per_table').optional().isBoolean(),
    body('lbp_exchange_rate').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }).withMessage('LBP exchange rate must be a non-negative number'),
  ],
  validateRequest,
  updateStore
);

router.delete(
  '/stores/:id',
  [param('id').isUUID()],
  validateRequest,
  deleteStore
);

// Terminal Management Routes
router.get(
  '/terminals',
  [
    query('store_id').optional().isUUID(),
    query('search').optional().isString(),
    query('is_active').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  getTerminals
);

router.get(
  '/terminals/:id',
  [param('id').isUUID()],
  validateRequest,
  getTerminalById
);

router.post(
  '/terminals',
  [
    body('store_id').isUUID(),
    body('code').trim().notEmpty(),
    body('name').trim().notEmpty(),
    body('is_active').optional().isBoolean(),
  ],
  validateRequest,
  createTerminal
);

router.put(
  '/terminals/:id',
  [
    param('id').isUUID(),
    body('store_id').optional().isUUID(),
    body('code').optional().trim().notEmpty(),
    body('name').optional().trim().notEmpty(),
    body('is_active').optional().isBoolean(),
  ],
  validateRequest,
  updateTerminal
);

router.delete(
  '/terminals/:id',
  [param('id').isUUID()],
  validateRequest,
  deleteTerminal
);

export default router;




