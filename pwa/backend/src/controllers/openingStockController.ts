import { Request, Response, NextFunction } from 'express';
import { OpeningStockModel } from '../models/OpeningStockModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// GET /api/opening-stock
export const getOpeningStock = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const store = await OpeningStockModel.getDefaultStore();
    if (!store) throw new CustomError('No active store found', 404);

    const session = await OpeningStockModel.getSession(store.store_id);

    res.status(200).json({ success: true, data: session });
  }
);

// POST /api/opening-stock  — save draft (create or update)
export const saveOpeningStock = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { notes, items } = req.body;
    const userId = req.user?.userId;

    if (!Array.isArray(items) || items.length === 0) {
      throw new CustomError('At least one item is required', 400);
    }

    for (const item of items) {
      if (!item.product_id) throw new CustomError('Each item must have a product_id', 400);
      if (typeof item.qty !== 'number' || isNaN(item.qty) || item.qty <= 0) {
        throw new CustomError('Each item qty must be a positive number', 400);
      }
    }

    const store = await OpeningStockModel.getDefaultStore();
    if (!store) throw new CustomError('No active store found', 404);

    const session = await OpeningStockModel.saveSession({
      store_id: store.store_id,
      notes,
      items,
      created_by: userId,
    });

    logger.info(`Opening stock draft saved: store=${store.store_id} items=${items.length}`);
    res.status(200).json({ success: true, data: session });
  }
);

// POST /api/opening-stock/commit
export const commitOpeningStock = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { session_id } = req.body;
    const userId = req.user?.userId;

    if (!session_id) throw new CustomError('session_id is required', 400);
    if (!userId) throw new CustomError('Unauthorized', 401);

    const store = await OpeningStockModel.getDefaultStore();
    if (!store) throw new CustomError('No active store found', 404);

    const session = await OpeningStockModel.commitSession(session_id, store.store_id, userId);

    res.status(200).json({ success: true, data: session });
  }
);

// DELETE /api/opening-stock/:session_id  — admin reset
export const deleteOpeningStock = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { session_id } = req.params;

    const store = await OpeningStockModel.getDefaultStore();
    if (!store) throw new CustomError('No active store found', 404);

    await OpeningStockModel.deleteSession(session_id, store.store_id);

    res.status(200).json({ success: true, message: 'Opening stock reset successfully' });
  }
);
