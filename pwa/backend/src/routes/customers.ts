import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customerController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/auth';
import { checkRecordLimit } from '../middleware/licenseCheck';
import { body, query, param } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// All customer routes require authentication
router.use(authenticate);

router.get(
  '/',
  [
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  getCustomers
);

router.get(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  getCustomerById
);

router.post(
  '/',
  authorize('manager', 'admin'),
  checkRecordLimit('customers'),
  [
    body('full_name').optional().trim().isString(),
    body('phone').optional().isString(),
    body('email').optional().isEmail(),
    body('notes').optional().isString(),
  ],
  validateRequest,
  createCustomer
);

router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('full_name').optional().trim().isString(),
    body('phone').optional().isString(),
    body('email').optional().isEmail(),
    body('notes').optional().isString(),
  ],
  validateRequest,
  updateCustomer
);

router.delete(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  deleteCustomer
);

export default router;







