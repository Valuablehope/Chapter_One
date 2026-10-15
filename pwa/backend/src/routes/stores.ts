import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getStoreSettings, getDefaultStore, patchStoreLabelLayout } from '../controllers/storeController';
import { param, body } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// All routes require authentication (but not admin role)
router.use(authenticate);

const labelAlign = ['left', 'center', 'right'] as const;
const labelLbpRowAlign = ['between', 'left', 'center', 'right'] as const;

const labelLayoutBodyValidators = [
  body('label_show_lbp').optional().isBoolean(),
  body('label_store_name_size').optional({ nullable: true }).isFloat({ min: 1, max: 99 }),
  body('label_product_name_size').optional({ nullable: true }).isFloat({ min: 1, max: 99 }),
  body('label_lbp_size').optional({ nullable: true }).isFloat({ min: 1, max: 99 }),
  body('label_price_size').optional({ nullable: true }).isFloat({ min: 1, max: 99 }),
  body('label_header_align').optional({ nullable: true }).isIn(labelAlign),
  body('label_title_align').optional({ nullable: true }).isIn(labelAlign),
  body('label_price_row_align').optional({ nullable: true }).isIn(labelAlign),
  body('label_lbp_row_align').optional({ nullable: true }).isIn(labelLbpRowAlign),
  body('label_header_font_weight').optional({ nullable: true }).isInt({ min: 100, max: 900 }),
  body('label_title_font_weight').optional({ nullable: true }).isInt({ min: 100, max: 900 }),
  body('label_lbp_prefix_size').optional({ nullable: true }).isFloat({ min: 1, max: 99 }),
  body('label_lbp_prefix_weight').optional({ nullable: true }).isInt({ min: 100, max: 900 }),
  body('label_lbp_amount_weight').optional({ nullable: true }).isInt({ min: 100, max: 900 }),
  body('label_currency_size').optional({ nullable: true }).isFloat({ min: 1, max: 99 }),
  body('label_currency_weight').optional({ nullable: true }).isInt({ min: 100, max: 900 }),
  body('label_price_amount_weight').optional({ nullable: true }).isInt({ min: 100, max: 900 }),
  body('label_section_order')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === undefined || value === null) return true;
      if (!Array.isArray(value)) return false;
      const ok = new Set(['header', 'title', 'lbp', 'price']);
      if (value.length !== 4) return false;
      const seen = new Set<string>();
      for (const x of value) {
        if (typeof x !== 'string' || !ok.has(x) || seen.has(x)) return false;
        seen.add(x);
      }
      return seen.size === 4;
    })
    .withMessage('label_section_order must list header, title, lbp, and price exactly once each'),
];

// Get default store (public for all authenticated users - needed for POS)
router.get(
  '/default',
  validateRequest,
  getDefaultStore
);

// Get store settings (public for all authenticated users - needed for POS)
router.get(
  '/:id/settings',
  [param('id').isUUID()],
  validateRequest,
  getStoreSettings
);

// Shelf label layout (managers + admins)
router.patch(
  '/:id/label-layout',
  authorize('manager', 'admin'),
  [param('id').isUUID(), ...labelLayoutBodyValidators],
  validateRequest,
  patchStoreLabelLayout
);

export default router;


