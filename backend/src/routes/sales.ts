import { Router } from 'express';
import { body } from 'express-validator';
import { createSale, getSaleById } from '../controllers/saleController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/auth';
import { checkRecordLimit } from '../middleware/licenseCheck';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create sale
router.post(
  '/',
  checkRecordLimit('sales'),
  [
    body('items').isArray({ min: 1 }).withMessage('Sale must have at least one item'),
    body('items.*.product_id').notEmpty().withMessage('Item product_id is required'),
    body('items.*.qty').isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
    body('items.*.unit_price').isFloat({ min: 0 }).withMessage('Item unit price must be positive'),
    body('items.*.tax_rate').optional().isFloat({ min: 0, max: 100 }),
    body('payments').isArray({ min: 1 }).withMessage('Sale must have at least one payment'),
    body('payments.*.method').isIn(['cash', 'card', 'voucher', 'other']).withMessage('Invalid payment method'),
    body('payments.*.amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than 0'),
    body('customer_id').optional().isUUID(),
  ],
  validateRequest,
  createSale
);

// Get sale by ID
router.get('/:id', getSaleById);

export default router;







