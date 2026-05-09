import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { getLicenseInfo, activateLicense, validateDevice, convexActivateLicense } from '../controllers/licenseController';

const router = Router();

// Get license info
router.get('/info', authenticate, getLicenseInfo);

// Activate license
router.post(
  '/activate',
  authenticate,
  [
    body('licenseKey').notEmpty().withMessage('License key is required'),
    body('deviceFingerprint').notEmpty().withMessage('Device fingerprint is required'),
    body('deviceName').optional().isString(),
  ],
  validateRequest,
  activateLicense
);

// Validate device
router.post(
  '/validate',
  authenticate,
  [
    body('deviceFingerprint').notEmpty().withMessage('Device fingerprint is required'),
  ],
  validateRequest,
  validateDevice
);

// Activate via Convex (new flow: consumes key remotely, saves locally)
router.post(
  '/convex-activate',
  authenticate,
  [
    body('licenseKey').notEmpty().withMessage('License key is required'),
    body('deviceId').optional().isString(),
    body('installationId').optional().isString(),
    body('customerName').optional().isString(),
    body('customerEmail').optional().isEmail().withMessage('Invalid customer email'),
    body('companyName').optional().isString(),
    body('storeName').optional().isString(),
  ],
  validateRequest,
  convexActivateLicense
);

export default router;





