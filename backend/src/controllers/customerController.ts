import { Request, Response } from 'express';
import { CustomerModel, CustomerFilters } from '../models/CustomerModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';

export const getCustomers = asyncHandler(async (req: Request, res: Response) => {
  const filters: CustomerFilters = {
    search: req.query.search as string,
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  const result = await CustomerModel.findAll(filters);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

export const getCustomerById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const customer = await CustomerModel.findById(id);

  if (!customer) {
    throw new CustomError('Customer not found', 404);
  }

  res.json({
    success: true,
    data: customer,
  });
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerModel.create(req.body);
  res.status(201).json({
    success: true,
    data: customer,
  });
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await CustomerModel.findById(id);

  if (!existing) {
    throw new CustomError('Customer not found', 404);
  }

  const customer = await CustomerModel.update(id, req.body);
  res.json({
    success: true,
    data: customer,
  });
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = await CustomerModel.delete(id);

  if (!deleted) {
    throw new CustomError('Customer not found', 404);
  }

  res.json({
    success: true,
    message: 'Customer deleted successfully',
  });
});











