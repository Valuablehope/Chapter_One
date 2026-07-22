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

  const {
    cash_actual,
    notes,
    cash_breakdown,
    cash_left_in_drawer,
    cash_left_in_drawer_breakdown,
    opening_float,
    opening_float_breakdown,
  } = req.body as {
    cash_actual?: number;
    notes?: string;
    cash_breakdown?: any;
    cash_left_in_drawer?: number;
    cash_left_in_drawer_breakdown?: any;
    opening_float?: number;
    opening_float_breakdown?: any;
  };
  if (cash_actual === undefined || cash_actual === null || typeof cash_actual !== 'number') {
    throw new CustomError('cash_actual is required', 400);
  }
  if (!Number.isFinite(cash_actual) || cash_actual < 0) {
    throw new CustomError('cash_actual must be a number >= 0', 400);
  }

  const cashLeftInDrawer = cash_left_in_drawer !== undefined && cash_left_in_drawer !== null ? cash_left_in_drawer : 0;
  if (!Number.isFinite(cashLeftInDrawer) || cashLeftInDrawer < 0) {
    throw new CustomError('cash_left_in_drawer must be a number >= 0', 400);
  }
  if (round2(cashLeftInDrawer) > round2(cash_actual)) {
    throw new CustomError('cash_left_in_drawer cannot exceed cash counted', 400);
  }

  if (
    opening_float !== undefined &&
    opening_float !== null &&
    (typeof opening_float !== 'number' || !Number.isFinite(opening_float) || opening_float < 0)
  ) {
    throw new CustomError('opening_float must be a number >= 0', 400);
  }

  const storeIdParam = req.query.store_id as string | undefined;
  const storeId = await DayClosureModel.resolveStoreId(storeIdParam);

  try {
    const closure = await DayClosureModel.close(
      storeId,
      userId,
      round2(cash_actual),
      typeof notes === 'string' ? notes : null,
      cash_breakdown,
      round2(cashLeftInDrawer),
      cash_left_in_drawer_breakdown,
      opening_float != null ? round2(opening_float) : null,
      opening_float_breakdown
    );
    logger.info(`Day closure Z-${closure.z_number} for store ${storeId} by ${userId}`);
    res.status(201).json({ success: true, data: closure });
  } catch (err: any) {
    if (
      err?.message === 'No unclosed sales to include in this closure' ||
      err?.message === 'cash_left_in_drawer cannot exceed cash counted'
    ) {
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
