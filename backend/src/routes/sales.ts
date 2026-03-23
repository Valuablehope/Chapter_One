import { Router } from 'express';
import { body, query } from 'express-validator';
import { getSales, createSale, getSaleById, updateSale } from '../controllers/saleController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/auth';
import { checkRecordLimit } from '../middleware/licenseCheck';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all sales with filters
router.get(
  '/',
  [
    query('search').optional().isString(),
    query('status').optional().isIn(['open', 'paid', 'void']),
    query('customer_id').optional().isUUID(),
    query('store_id').optional().isUUID(),
    query('start_date').optional().isISO8601().toDate(),
    query('end_date').optional().isISO8601().toDate(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  getSales
);

// Create sale
router.post(
  '/',
  checkRecordLimit('sales'),
  [
    body('items')
      .isArray({ min: 1, max: 100 })
      .withMessage('Sale must have at least one item and at most 100 items'),
    body('items.*.product_id').notEmpty().withMessage('Item product_id is required'),
    body('items.*.qty').isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
    body('items.*.unit_price').isFloat({ min: 0 }).withMessage('Item unit price must be positive'),
    body('items.*.tax_rate').optional().isFloat({ min: 0, max: 100 }),
    body('payments')
      .isArray({ min: 1, max: 10 })
      .withMessage('Sale must have at least one payment and at most 10 payments'),
    body('payments.*.method').isIn(['cash', 'card', 'voucher', 'other']).withMessage('Invalid payment method'),
    body('payments.*.amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than 0'),
    body('customer_id').optional().isUUID(),
    body('restaurant_context').optional().isObject(),
    body('restaurant_context.table_number').optional().isInt({ min: 1 }),
    body('restaurant_context.guest_count').optional().isInt({ min: 1 }),
    body('restaurant_context.waiter_name').optional().isString().isLength({ max: 255 }),
    body('restaurant_context.seated_at').optional().isISO8601(),
    body('restaurant_context.checkout_at').optional().isISO8601(),
    body('restaurant_context.service_fee_enabled').optional().isBoolean(),
    body('restaurant_context.service_fee_rate').optional().isFloat({ min: 0, max: 100 }),
    body('restaurant_context.service_fee_amount').optional().isFloat({ min: 0 }),
    body('restaurant_context.subtotal_before_service').optional().isFloat({ min: 0 }),
    body('restaurant_context.notes').optional().isString().isLength({ max: 1000 }),
  ],
  validateRequest,
  createSale
);

// Get sale by ID
router.get('/:id', getSaleById);

// Update sale
router.put(
  '/:id',
  [
    body('items').optional().isArray({ min: 1 }),
    body('items.*.product_id').optional().notEmpty(),
    body('items.*.qty').optional().isInt({ min: 1 }),
    body('items.*.unit_price').optional().isFloat({ min: 0 }),
    body('items.*.tax_rate').optional().isFloat({ min: 0, max: 100 }),
    body('payments').optional().isArray({ min: 1 }),
    body('payments.*.method').optional().isIn(['cash', 'card', 'voucher', 'other']),
    body('payments.*.amount').optional().isFloat({ min: 0.01 }),
    body('customer_id').optional().isUUID(),
  ],
  validateRequest,
  updateSale
);

export default router;







