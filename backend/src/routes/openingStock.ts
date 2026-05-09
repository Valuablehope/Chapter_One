import { Router } from 'express';
import { body } from 'express-validator';
import {
  getOpeningStock,
  saveOpeningStock,
  commitOpeningStock,
  deleteOpeningStock,
} from '../controllers/openingStockController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET current session for the store
router.get('/', getOpeningStock);

// POST save draft
router.post(
  '/',
  [
    body('items')
      .isArray({ min: 1 })
      .withMessage('items must be a non-empty array'),
    body('items.*.product_id')
      .notEmpty()
      .withMessage('Each item must have a product_id'),
    body('items.*.qty')
      .isInt({ min: 1 })
      .withMessage('Each item qty must be a positive integer'),
    body('notes').optional().isString(),
  ],
  validateRequest,
  saveOpeningStock
);

// POST commit session (creates stock movements)
router.post(
  '/commit',
  [body('session_id').notEmpty().withMessage('session_id is required')],
  validateRequest,
  commitOpeningStock
);

// DELETE reset session — admin only
router.delete('/:session_id', authorize('admin'), deleteOpeningStock);

export default router;
