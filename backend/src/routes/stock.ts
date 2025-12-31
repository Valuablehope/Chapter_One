import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getStockBalance, getStockBalances } from '../controllers/stockController';
import { body, param } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get stock balance for a single product
router.get(
  '/:product_id',
  [
    param('product_id').isUUID().withMessage('Invalid product ID'),
  ],
  validateRequest,
  getStockBalance
);

// Get stock balances for multiple products (batch)
router.post(
  '/batch',
  [
    body('product_ids')
      .isArray({ min: 1 })
      .withMessage('product_ids must be a non-empty array'),
    body('product_ids.*')
      .isUUID()
      .withMessage('All product IDs must be valid UUIDs'),
  ],
  validateRequest,
  getStockBalances
);

export default router;

