import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  getReasons,
  createReason,
  deleteReason,
  getDisposals,
  getDisposalById,
  createDisposal,
  deleteDisposal,
} from '../controllers/disposeController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─── Reasons ─────────────────────────────────────────────────────────────────

router.get('/reasons', getReasons);

router.post(
  '/reasons',
  authorize('admin', 'manager'),
  [body('name').trim().notEmpty().withMessage('Reason name is required').isLength({ max: 100 })],
  validateRequest,
  createReason
);

router.delete(
  '/reasons/:id',
  authorize('admin'),
  [param('id').isInt({ min: 1 }).withMessage('Invalid reason id')],
  validateRequest,
  deleteReason
);

// ─── Disposals ───────────────────────────────────────────────────────────────

router.get(
  '/',
  [
    query('date').optional().isDate().withMessage('date must be YYYY-MM-DD'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  validateRequest,
  getDisposals
);

router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid disposal id')],
  validateRequest,
  getDisposalById
);

router.post(
  '/',
  authorize('admin', 'manager'),
  [
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
    body('items.*.product_id').notEmpty().withMessage('Each item must have a product_id'),
    body('items.*.qty').isFloat({ min: 0.001 }).withMessage('Each item qty must be a positive number'),
    body('items.*.reason_id').isInt({ min: 1 }).withMessage('Each item must have a reason_id'),
    body('items.*.note').optional().isString().isLength({ max: 500 }),
    body('notes').optional().isString().isLength({ max: 2000 }),
  ],
  validateRequest,
  createDisposal
);

router.delete(
  '/:id',
  authorize('admin'),
  [param('id').isUUID().withMessage('Invalid disposal id')],
  validateRequest,
  deleteDisposal
);

export default router;
