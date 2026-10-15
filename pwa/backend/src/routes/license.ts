import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { getLicenseInfo, convexActivateLicense, listMobileSessions, revokeMobileSession } from '../controllers/licenseController';

const router = Router();

// Get license info
router.get('/info', authenticate, getLicenseInfo);

// Mobile companion device management
router.get('/mobile-sessions', authenticate, listMobileSessions);
router.post('/mobile-sessions/:sessionId/revoke', authenticate, revokeMobileSession);

// Activate via Convex (consumes key remotely, saves locally)
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





