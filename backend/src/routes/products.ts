import { Router } from 'express';
import {
  getProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  validateBarcode,
} from '../controllers/productController';
import { authenticate } from '../middleware/auth';
import { checkRecordLimit } from '../middleware/licenseCheck';
import { body, query, param } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// All product routes require authentication
router.use(authenticate);

// Get all products with filters
router.get(
  '/',
  [
    query('search').optional().isString(),
    query('product_type').optional().isString(),
    query('track_inventory').optional().isBoolean(),
    query('pos_category_only').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 2000 }),
  ],
  validateRequest,
  getProducts
);

// Get product by ID
router.get(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  getProductById
);

// Get product by barcode
router.get(
  '/barcode/:barcode',
  [param('barcode').notEmpty()],
  validateRequest,
  getProductByBarcode
);

// Create product
router.post(
  '/',
  checkRecordLimit('products'),
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('product_type').optional().isString(),
    body('unit_of_measure').optional().isString(),
    body('sku').optional().isString(),
    body('barcode').optional().isString(),
    body('list_price').optional().isFloat({ min: 0 }),
    body('sale_price').optional().isFloat({ min: 0 }),
    body('tax_rate').optional().isFloat({ min: 0, max: 100 }),
    body('track_inventory').optional().isBoolean(),
  ],
  validateRequest,
  createProduct
);

// Update product
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('product_type').optional().isString(),
    body('unit_of_measure').optional().isString(),
    body('sku').optional().isString(),
    body('barcode').optional().isString(),
    body('list_price').optional().isFloat({ min: 0 }),
    body('sale_price').optional().isFloat({ min: 0 }),
    body('tax_rate').optional().isFloat({ min: 0, max: 100 }),
    body('track_inventory').optional().isBoolean(),
  ],
  validateRequest,
  updateProduct
);

// Delete product
router.delete(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  deleteProduct
);

// Validate barcode uniqueness
router.post(
  '/validate-barcode',
  [
    body('barcode').notEmpty().withMessage('Barcode is required'),
    body('exclude_product_id').optional().isUUID(),
  ],
  validateRequest,
  validateBarcode
);

export default router;







