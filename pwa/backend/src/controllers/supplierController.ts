import { Request, Response } from 'express';
import { SupplierModel, SupplierFilters } from '../models/SupplierModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';

export const getSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const filters: SupplierFilters = {
    search: req.query.search as string,
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  const result = await SupplierModel.findAll(filters);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

export const getSupplierById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const supplier = await SupplierModel.findById(id);

  if (!supplier) {
    throw new CustomError('Supplier not found', 404);
  }

  res.json({
    success: true,
    data: supplier,
  });
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await SupplierModel.create(req.body);
  res.status(201).json({
    success: true,
    data: supplier,
  });
});

export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await SupplierModel.findById(id);

  if (!existing) {
    throw new CustomError('Supplier not found', 404);
  }

  const supplier = await SupplierModel.update(id, req.body);
  res.json({
    success: true,
    data: supplier,
  });
});

export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = await SupplierModel.delete(id);

  if (!deleted) {
    throw new CustomError('Supplier not found', 404);
  }

  res.json({
    success: true,
    message: 'Supplier deleted successfully',
  });
});











