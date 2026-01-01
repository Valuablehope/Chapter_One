import { Router } from 'express';
import { body } from 'express-validator';
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  receivePurchaseOrder,
  deletePurchaseOrder,
} from '../controllers/purchaseController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/auth';
import { checkRecordLimit } from '../middleware/licenseCheck';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all purchase orders
router.get('/', getPurchaseOrders);

// Get purchase order by ID
router.get('/:id', getPurchaseOrderById);

// Create purchase order
router.post(
  '/',
  checkRecordLimit('purchases'),
  [
    body('supplier_id').notEmpty().withMessage('Supplier ID is required'),
    body('items')
      .isArray({ min: 1, max: 100 })
      .withMessage('Purchase order must have at least one item and at most 100 items'),
    body('items.*.product_id').notEmpty().withMessage('Item product_id is required'),
    body('items.*.qty_ordered').isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
    body('items.*.unit_cost').isFloat({ min: 0 }).withMessage('Item unit cost must be positive'),
    body('expected_at').optional().isISO8601().withMessage('Expected date must be a valid date'),
  ],
  validateRequest,
  createPurchaseOrder
);

// Update purchase order
router.put(
  '/:id',
  [
    body('supplier_id').optional().notEmpty().withMessage('Supplier ID cannot be empty'),
    body('items')
      .optional()
      .isArray({ min: 1, max: 100 })
      .withMessage('Purchase order must have at least one item and at most 100 items'),
    body('items.*.product_id').optional().notEmpty().withMessage('Item product_id is required'),
    body('items.*.qty_ordered').optional().isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
    body('items.*.unit_cost').optional().isFloat({ min: 0 }).withMessage('Item unit cost must be positive'),
    body('expected_at').optional().isISO8601().withMessage('Expected date must be a valid date'),
  ],
  validateRequest,
  updatePurchaseOrder
);

// Update purchase order status
router.patch(
  '/:id/status',
  [
    body('status').isIn(['OPEN', 'PENDING', 'RECEIVED', 'CANCELLED']).withMessage('Invalid status'),
  ],
  validateRequest,
  updatePurchaseOrderStatus
);

// Receive purchase order
router.post('/:id/receive', receivePurchaseOrder);

// Delete purchase order
router.delete('/:id', deletePurchaseOrder);

export default router;







