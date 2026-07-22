import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { getDayClosurePreview, postDayClosure } from '../controllers/dayClosureController';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'manager', 'cashier'));

router.get(
  '/preview',
  [query('store_id').optional().isUUID().withMessage('store_id must be a UUID')],
  validateRequest,
  getDayClosurePreview
);

router.post(
  '/close',
  [
    query('store_id').optional().isUUID().withMessage('store_id must be a UUID'),
    body('cash_actual').isFloat({ min: 0 }).withMessage('cash_actual must be >= 0'),
    body('notes').optional().isString().isLength({ max: 2000 }),
    body('cash_left_in_drawer').optional().isFloat({ min: 0 }).withMessage('cash_left_in_drawer must be >= 0'),
    body('opening_float').optional().isFloat({ min: 0 }).withMessage('opening_float must be >= 0'),
  ],
  validateRequest,
  postDayClosure
);

export default router;
