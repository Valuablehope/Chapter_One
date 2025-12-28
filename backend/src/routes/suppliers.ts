import { Router } from 'express';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplierController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/auth';
import { checkRecordLimit } from '../middleware/licenseCheck';
import { body, query, param } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// All supplier routes require authentication
router.use(authenticate);

router.get(
  '/',
  [
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  getSuppliers
);

router.get(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  getSupplierById
);

router.post(
  '/',
  authorize('manager', 'admin'),
  checkRecordLimit('suppliers'),
  [
    body('name').trim().notEmpty().withMessage('Supplier name is required'),
    body('contact_name').optional().trim().isString(),
    body('phone').optional().isString(),
    body('email').optional().isEmail(),
  ],
  validateRequest,
  createSupplier
);

router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('contact_name').optional().trim().isString(),
    body('phone').optional().isString(),
    body('email').optional().isEmail(),
  ],
  validateRequest,
  updateSupplier
);

router.delete(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  deleteSupplier
);

export default router;







