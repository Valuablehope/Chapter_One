import { Router } from 'express';
import {
  getProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  validateBarcode,
  bulkImportProducts,
  uploadImage,
} from '../controllers/productController';
import { authenticate } from '../middleware/auth';
import { checkRecordLimit } from '../middleware/licenseCheck';
import { body, query, param } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';
import { uploadProductImage } from '../middleware/upload';


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
 
// Upload product image
router.post(
  '/upload',
  uploadProductImage.single('image'),
  uploadImage
);

// Bulk import products (must be before /:id route)
router.post(
  '/bulk-import',
  [
    body('products').isArray({ min: 1, max: 50000 }).withMessage('products must be a non-empty array'),
    body('products.*.name').trim().notEmpty().withMessage('Each product must have a name'),
    body('products.*.list_price').optional().isFloat({ min: 0 }),
    body('products.*.sale_price').optional().isFloat({ min: 0 }),
    body('products.*.tax_rate').optional().isFloat({ min: 0, max: 100 }),
  ],
  validateRequest,
  bulkImportProducts
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
    body('plu_code').optional({ nullable: true }).isInt({ min: 0, max: 9999999999 }),
    body('list_price').optional().isFloat({ min: 0 }),
    body('sale_price').optional().isFloat({ min: 0 }),
    body('tax_rate').optional().isFloat({ min: 0, max: 100 }),
    body('track_inventory').optional().isBoolean(),
    body('image_url').optional().isString(),
    body('menu_id').optional({ nullable: true, values: 'falsy' }).isUUID(),
    body('menu_category').optional({ nullable: true }).isString(),
    body('menu_display_order').optional().isInt({ min: 0 }),
    body('menu_note').optional({ nullable: true }).isString(),
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
    body('plu_code').optional({ nullable: true }).isInt({ min: 0, max: 9999999999 }),
    body('list_price').optional().isFloat({ min: 0 }),
    body('sale_price').optional().isFloat({ min: 0 }),
    body('tax_rate').optional().isFloat({ min: 0, max: 100 }),
    body('track_inventory').optional().isBoolean(),
    body('image_url').optional().isString(),
    body('menu_id').optional({ nullable: true, values: 'falsy' }).isUUID(),
    body('menu_category').optional({ nullable: true }).isString(),
    body('menu_display_order').optional().isInt({ min: 0 }),
    body('menu_note').optional({ nullable: true }).isString(),
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







