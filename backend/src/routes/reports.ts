import { Router } from 'express';
import {
  getSalesSummary,
  getProductSales,
  getCustomerSales,
  getPaymentMethodReport,
  getPurchaseSummary,
  getSupplierPurchases,
  getStockReport,
  getLowStockReport,
} from '../controllers/reportController';
import { authenticate } from '../middleware/auth';
import { query } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// All report routes require authentication
router.use(authenticate);

router.get(
  '/sales/summary',
  [
    query('start_date').optional().isISO8601().toDate(),
    query('end_date').optional().isISO8601().toDate(),
    query('store_id').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
  ],
  validateRequest,
  getSalesSummary
);

router.get(
  '/sales/products',
  [
    query('start_date').optional().isISO8601().toDate(),
    query('end_date').optional().isISO8601().toDate(),
    query('store_id').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
  ],
  validateRequest,
  getProductSales
);

router.get(
  '/sales/customers',
  [
    query('start_date').optional().isISO8601().toDate(),
    query('end_date').optional().isISO8601().toDate(),
    query('store_id').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
  ],
  validateRequest,
  getCustomerSales
);

router.get(
  '/sales/payment-methods',
  [
    query('start_date').optional().isISO8601().toDate(),
    query('end_date').optional().isISO8601().toDate(),
    query('store_id').optional().isUUID(),
  ],
  validateRequest,
  getPaymentMethodReport
);

router.get(
  '/purchases/summary',
  [
    query('start_date').optional().isISO8601().toDate(),
    query('end_date').optional().isISO8601().toDate(),
    query('store_id').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
  ],
  validateRequest,
  getPurchaseSummary
);

router.get(
  '/purchases/suppliers',
  [
    query('start_date').optional().isISO8601().toDate(),
    query('end_date').optional().isISO8601().toDate(),
    query('store_id').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
  ],
  validateRequest,
  getSupplierPurchases
);

router.get(
  '/inventory/stock',
  [
    query('store_id').optional().isUUID(),
  ],
  validateRequest,
  getStockReport
);

router.get(
  '/inventory/low-stock',
  [
    query('store_id').optional().isUUID(),
    query('threshold').optional().isInt({ min: 0 }),
  ],
  validateRequest,
  getLowStockReport
);

export default router;











