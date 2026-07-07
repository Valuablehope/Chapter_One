import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import {
  listDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  testDevice,
  syncDevice,
  getPresets,
  listFormats,
  createFormat,
  updateFormat,
  deleteFormat,
  testParse,
  listPluProducts,
  exportPluCsv,
} from '../controllers/scaleController';

const router = Router();

router.use(authenticate);

// Brand presets (static config)
router.get('/presets', getPresets);

// PLU payload preview / universal CSV export
router.get('/plu-products', listPluProducts);
router.get('/export/csv', exportPluCsv);

// Decode a scanned label (admin test tool)
router.post(
  '/parse',
  [body('barcode').trim().notEmpty().withMessage('Barcode is required')],
  validateRequest,
  testParse
);

// ---------- Devices ----------

const deviceValidators = [
  body('name').optional().trim().notEmpty(),
  body('brand').optional().isString(),
  body('driver').optional().isIn(['generic_tcp', 'csv_export']),
  body('host').optional({ nullable: true }).isString(),
  body('port').optional({ nullable: true }).isInt({ min: 1, max: 65535 }),
  body('department').optional({ nullable: true }).isInt({ min: 0 }),
  body('options').optional().isObject(),
  body('is_active').optional().isBoolean(),
];

router.get('/devices', listDevices);

router.post(
  '/devices',
  [body('name').trim().notEmpty().withMessage('Scale name is required'), ...deviceValidators.slice(1)],
  validateRequest,
  createDevice
);

router.put(
  '/devices/:id',
  [param('id').isUUID(), ...deviceValidators],
  validateRequest,
  updateDevice
);

router.delete('/devices/:id', [param('id').isUUID()], validateRequest, deleteDevice);

router.post('/devices/:id/test', [param('id').isUUID()], validateRequest, testDevice);

router.post('/devices/:id/sync', [param('id').isUUID()], validateRequest, syncDevice);

// ---------- Barcode formats ----------

const formatValidators = [
  body('name').optional().trim().notEmpty(),
  body('prefixes')
    .optional()
    .trim()
    .notEmpty()
    .matches(/^\d+(\s*,\s*\d+)*$/)
    .withMessage('Prefixes must be comma-separated digits'),
  body('plu_length').optional().isInt({ min: 1, max: 10 }),
  body('value_length').optional().isInt({ min: 0, max: 10 }),
  body('value_type').optional().isIn(['price', 'weight', 'quantity', 'none']),
  body('value_divisor').optional().isFloat({ gt: 0 }),
  body('check_digit').optional().isIn(['none', 'ean13']),
  body('is_active').optional().isBoolean(),
  body('priority').optional().isInt(),
];

router.get('/formats', listFormats);

router.post(
  '/formats',
  [
    body('name').trim().notEmpty().withMessage('Format name is required'),
    body('prefixes')
      .trim()
      .notEmpty()
      .matches(/^\d+(\s*,\s*\d+)*$/)
      .withMessage('Prefixes must be comma-separated digits'),
    body('plu_length').isInt({ min: 1, max: 10 }),
    body('value_length').isInt({ min: 0, max: 10 }),
    body('value_type').isIn(['price', 'weight', 'quantity', 'none']),
    body('value_divisor').isFloat({ gt: 0 }),
    body('check_digit').isIn(['none', 'ean13']),
    body('is_active').optional().isBoolean(),
    body('priority').optional().isInt(),
  ],
  validateRequest,
  createFormat
);

router.put(
  '/formats/:id',
  [param('id').isUUID(), ...formatValidators],
  validateRequest,
  updateFormat
);

router.delete('/formats/:id', [param('id').isUUID()], validateRequest, deleteFormat);

export default router;
