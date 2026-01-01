import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getStoreSettings, getDefaultStore } from '../controllers/storeController';
import { param } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// All routes require authentication (but not admin role)
router.use(authenticate);

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

export default router;

