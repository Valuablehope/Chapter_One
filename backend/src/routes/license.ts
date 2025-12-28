import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { getLicenseInfo, activateLicense, validateDevice } from '../controllers/licenseController';

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

export default router;





