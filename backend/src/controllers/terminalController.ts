import { Request, Response } from 'express';
import { TerminalModel, TerminalFilters } from '../models/TerminalModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';

export const getTerminals = asyncHandler(async (req: Request, res: Response) => {
  const filters: TerminalFilters = {
    store_id: req.query.store_id as string,
    search: req.query.search as string,
    is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  const result = await TerminalModel.findAll(filters);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

export const getTerminalById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const terminal = await TerminalModel.findById(id);

  if (!terminal) {
    throw new CustomError('Terminal not found', 404);
  }

  res.json({
    success: true,
    data: terminal,
  });
});

export const createTerminal = asyncHandler(async (req: Request, res: Response) => {
  const terminal = await TerminalModel.create(req.body);
  res.status(201).json({
    success: true,
    data: terminal,
  });
});

export const updateTerminal = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await TerminalModel.findById(id);

  if (!existing) {
    throw new CustomError('Terminal not found', 404);
  }

  const terminal = await TerminalModel.update(id, req.body);
  res.json({
    success: true,
    data: terminal,
  });
});

export const deleteTerminal = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = await TerminalModel.delete(id);

  if (!deleted) {
    throw new CustomError('Terminal not found', 404);
  }

  res.json({
    success: true,
    message: 'Terminal deleted successfully',
  });
});











