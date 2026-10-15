import { Request, Response, NextFunction } from 'express';
import { DisposeModel } from '../models/DisposeModel';
import { DayClosureModel } from '../models/DayClosureModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';

// ─── Reasons ─────────────────────────────────────────────────────────────────

export const getReasons = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const storeId = await DayClosureModel.resolveStoreId();
  const reasons = await DisposeModel.getReasons(storeId);
  res.status(200).json({ success: true, data: reasons });
});

export const createReason = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { name } = req.body;
  if (!name?.trim()) throw new CustomError('Reason name is required', 400);

  const storeId = await DayClosureModel.resolveStoreId();
  const reason = await DisposeModel.createReason(storeId, name);
  res.status(201).json({ success: true, data: reason });
});

export const deleteReason = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const storeId = await DayClosureModel.resolveStoreId();
  try {
    await DisposeModel.deleteReason(Number(id), storeId);
    res.status(200).json({ success: true, message: 'Reason deleted' });
  } catch (err: any) {
    if (err?.message === 'Reason not found or cannot be deleted') {
      throw new CustomError(err.message, 400);
    }
    throw err;
  }
});

// ─── Disposals ───────────────────────────────────────────────────────────────

export const getDisposals = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const date = req.query.date as string | undefined;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

  const storeId = await DayClosureModel.resolveStoreId();
  const result = await DisposeModel.listDisposals(storeId, page, limit, date);

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  });
});

export const getDisposalById = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const storeId = await DayClosureModel.resolveStoreId();
  const disposal = await DisposeModel.getDisposalById(id, storeId);
  if (!disposal) throw new CustomError('Disposal not found', 404);
  res.status(200).json({ success: true, data: disposal });
});

export const createDisposal = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { items, notes } = req.body as {
    items?: { product_id?: string; qty?: number; reason_id?: number; note?: string }[];
    notes?: string;
  };
  const userId = req.user?.userId;
  if (!userId) throw new CustomError('User not authenticated', 401);

  if (!Array.isArray(items) || items.length === 0) {
    throw new CustomError('At least one item is required', 400);
  }
  for (const item of items) {
    if (!item.product_id) throw new CustomError('Each item must have a product_id', 400);
    if (typeof item.qty !== 'number' || !Number.isFinite(item.qty) || item.qty <= 0) {
      throw new CustomError('Each item qty must be a positive number', 400);
    }
    if (!item.reason_id) throw new CustomError('Each item must have a reason_id', 400);
  }

  const storeId = await DayClosureModel.resolveStoreId();

  try {
    const disposal = await DisposeModel.createDisposal(
      storeId,
      userId,
      items.map((i) => ({
        product_id: i.product_id!,
        qty: i.qty!,
        reason_id: Number(i.reason_id),
        note: i.note,
      })),
      typeof notes === 'string' ? notes : null
    );
    res.status(201).json({ success: true, data: disposal });
  } catch (err: any) {
    if (
      typeof err?.message === 'string' &&
      (err.message.includes('cannot dispose') ||
        err.message.includes('does not track inventory') ||
        err.message === 'Product not found' ||
        err.message === 'At least one item is required' ||
        err.message === 'Each item qty must be a positive number')
    ) {
      throw new CustomError(err.message, 400);
    }
    throw err;
  }
});

export const deleteDisposal = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const storeId = await DayClosureModel.resolveStoreId();
  try {
    await DisposeModel.deleteDisposal(id, storeId);
    res.status(200).json({ success: true, message: 'Disposal reversed and deleted' });
  } catch (err: any) {
    if (err?.message === 'Disposal not found') {
      throw new CustomError(err.message, 404);
    }
    throw err;
  }
});
