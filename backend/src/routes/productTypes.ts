import { Router } from 'express';
import {
  getProductTypes,
  createProductType,
  updateProductType,
  deleteProductType
} from '../controllers/productTypeController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getProductTypes);
router.post('/', createProductType);
router.put('/:id', updateProductType);
router.delete('/:id', deleteProductType);

export default router;
