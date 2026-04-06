import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { getDayClosurePreview, postDayClosure } from '../controllers/dayClosureController';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'manager'));

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
  ],
  validateRequest,
  postDayClosure
);

export default router;
