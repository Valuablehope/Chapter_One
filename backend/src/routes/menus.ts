import { Router } from 'express';
import { body, query } from 'express-validator';
import {
  getMenus,
  getMenuById,
  createMenu,
  updateMenu,
  deleteMenu,
} from '../controllers/menuController';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

router.get(
  '/',
  [
    query('store_id').notEmpty().isUUID(),
    query('search').optional().isString(),
    query('is_active').optional().isBoolean().toBoolean(),
    query('menu_type').optional().isIn(['regular', 'holiday', 'seasonal', 'event', 'special']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  validateRequest,
  getMenus
);
router.get('/:id', getMenuById);
router.post(
  '/',
  [
    body('store_id').notEmpty().isUUID(),
    body('name').notEmpty().isString(),
    body('description').optional({ nullable: true }).isString(),
    body('menu_type').optional().isIn(['regular', 'holiday', 'seasonal', 'event', 'special']),
    body('is_active').optional().isBoolean().toBoolean(),
    body('display_order').optional().isInt({ min: 0 }).toInt(),
  ],
  validateRequest,
  createMenu
);
router.put(
  '/:id',
  [
    body('name').optional().isString(),
    body('description').optional({ nullable: true }).isString(),
    body('menu_type').optional().isIn(['regular', 'holiday', 'seasonal', 'event', 'special']),
    body('is_active').optional().isBoolean().toBoolean(),
    body('display_order').optional().isInt({ min: 0 }).toInt(),
  ],
  validateRequest,
  updateMenu
);
router.delete('/:id', deleteMenu);

export default router;
