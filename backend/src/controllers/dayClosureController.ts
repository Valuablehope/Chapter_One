import { Request, Response, NextFunction } from 'express';
import { DayClosureModel } from '../models/DayClosureModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const getDayClosurePreview = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const storeIdParam = req.query.store_id as string | undefined;
    const storeId = await DayClosureModel.resolveStoreId(storeIdParam);
    const preview = await DayClosureModel.preview(storeId);
    res.json({ success: true, data: preview });
  }
);

export const postDayClosure = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }

  const { cash_actual, notes } = req.body as { cash_actual?: number; notes?: string };
  if (cash_actual === undefined || cash_actual === null || typeof cash_actual !== 'number') {
    throw new CustomError('cash_actual is required', 400);
  }
  if (!Number.isFinite(cash_actual) || cash_actual < 0) {
    throw new CustomError('cash_actual must be a number >= 0', 400);
  }

  const storeIdParam = req.query.store_id as string | undefined;
  const storeId = await DayClosureModel.resolveStoreId(storeIdParam);

  try {
    const closure = await DayClosureModel.close(
      storeId,
      userId,
      round2(cash_actual),
      typeof notes === 'string' ? notes : null
    );
    logger.info(`Day closure Z-${closure.z_number} for store ${storeId} by ${userId}`);
    res.status(201).json({ success: true, data: closure });
  } catch (err: any) {
    if (err?.message === 'No unclosed sales to include in this closure') {
      throw new CustomError(err.message, 400);
    }
    if (err?.message === 'No active store configured' || err?.message === 'Store not found or inactive') {
      throw new CustomError(err.message, 400);
    }
    throw err;
  }
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
