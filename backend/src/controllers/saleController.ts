import { Request, Response, NextFunction } from 'express';
import { SaleModel, CreateSaleData, SaleFilters, UpdateSaleData } from '../models/SaleModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// Create sale
export const createSale = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      throw new CustomError('User not authenticated', 401);
    }

    const { customer_id, items, payments, discount_rate, client_sale_id, restaurant_context } = req.body;

    // Validate input
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new CustomError('Sale must have at least one item', 400);
    }

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      throw new CustomError('Sale must have at least one payment', 400);
    }

    // Validate items with better error messages
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_id) {
        throw new CustomError(`Item ${i + 1}: product_id is required`, 400);
      }
      if (item.qty === undefined || item.qty === null) {
        throw new CustomError(`Item ${i + 1}: qty is required`, 400);
      }
      if (item.qty <= 0) {
        throw new CustomError(`Item ${i + 1}: quantity must be greater than 0`, 400);
      }
      if (item.unit_price === undefined || item.unit_price === null) {
        throw new CustomError(`Item ${i + 1}: unit_price is required`, 400);
      }
      if (item.unit_price < 0) {
        throw new CustomError(`Item ${i + 1}: unit price cannot be negative`, 400);
      }
    }

    // Validate payments
    for (const payment of payments) {
      if (!payment.method || !payment.amount) {
        throw new CustomError('Each payment must have method and amount', 400);
      }
      if (payment.amount <= 0) {
        throw new CustomError('Payment amount must be greater than 0', 400);
      }
    }

    const saleData: CreateSaleData = {
      customer_id,
      items,
      payments,
      discount_rate,
      client_sale_id,
      restaurant_context,
    };

    const sale = await SaleModel.create(userId, saleData);

    logger.info(`Sale created: ${sale.receipt_no} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: sale,
    });
  }
);

// Get all sales with filters
export const getSales = asyncHandler(async (req: Request, res: Response) => {
  const filters: SaleFilters = {
    search: req.query.search as string,
    status: req.query.status as any,
    customer_id: req.query.customer_id as string,
    store_id: req.query.store_id as string,
    start_date: req.query.start_date as string,
    end_date: req.query.end_date as string,
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  const result = await SaleModel.findAll(filters);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

// Get sale by ID
export const getSaleById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const sale = await SaleModel.findById(id);

    if (!sale) {
      throw new CustomError('Sale not found', 404);
    }

    res.status(200).json({
      success: true,
      data: sale,
    });
  }
);

// Update sale
export const updateSale = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      throw new CustomError('User not authenticated', 401);
    }

    const { id } = req.params;
    const { customer_id, items, payments, discount_rate } = req.body;

    // Validate items if provided
    if (items && Array.isArray(items)) {
      if (items.length === 0) {
        throw new CustomError('Sale must have at least one item', 400);
      }
      for (const item of items) {
        if (!item.product_id || !item.qty || !item.unit_price) {
          throw new CustomError('Each item must have product_id, qty, and unit_price', 400);
        }
        if (item.qty <= 0) {
          throw new CustomError('Item quantity must be greater than 0', 400);
        }
        if (item.unit_price < 0) {
          throw new CustomError('Item unit price cannot be negative', 400);
        }
      }
    }

    // Validate payments if provided
    if (payments && Array.isArray(payments)) {
      if (payments.length === 0) {
        throw new CustomError('Sale must have at least one payment', 400);
      }
      for (const payment of payments) {
        if (!payment.method || !payment.amount) {
          throw new CustomError('Each payment must have method and amount', 400);
        }
        if (payment.amount <= 0) {
          throw new CustomError('Payment amount must be greater than 0', 400);
        }
      }
    }

    const updateData: UpdateSaleData = {
      customer_id,
      items,
      payments,
      discount_rate,
    };

    const sale = await SaleModel.update(id, userId, updateData);

    logger.info(`Sale updated: ${sale.receipt_no} by user ${userId}`);

    res.json({
      success: true,
      data: sale,
    });
  }
);











