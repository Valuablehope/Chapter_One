import { Router } from 'express';
import { ProductModel } from '../models/ProductModel';
import { authenticate } from '../middleware/auth';
import { param, body } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';
import { asyncHandler } from '../middleware/errorHandler';
import { CustomError } from '../middleware/errorHandler';

const router = Router();

// All barcode routes require authentication
router.use(authenticate);

// Lookup product by barcode
router.get(
  '/:barcode',
  [param('barcode').notEmpty().withMessage('Barcode is required')],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { barcode } = req.params;
    const product = await ProductModel.findByBarcode(barcode);

    if (!product) {
      throw new CustomError('Product not found', 404);
    }

    res.json({
      success: true,
      data: product,
    });
  })
);

// Validate barcode format and uniqueness
router.post(
  '/validate',
  [
    body('barcode').notEmpty().withMessage('Barcode is required'),
    body('exclude_product_id').optional().isUUID(),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { barcode, exclude_product_id } = req.body;

    // Basic barcode format validation (EAN-13, UPC, etc.)
    const barcodeRegex = /^[0-9]{8,13}$/;
    const isValidFormat = barcodeRegex.test(barcode);

    if (!isValidFormat) {
      return res.json({
        success: true,
        data: {
          barcode,
          isValidFormat: false,
          isUnique: false,
          message: 'Invalid barcode format. Must be 8-13 digits.',
        },
      });
    }

    const isUnique = await ProductModel.checkBarcodeUnique(barcode, exclude_product_id);

    res.json({
      success: true,
      data: {
        barcode,
        isValidFormat: true,
        isUnique,
      },
    });
  })
);

export default router;











