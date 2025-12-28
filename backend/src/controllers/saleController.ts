import { Request, Response, NextFunction } from 'express';
import { SaleModel, CreateSaleData } from '../models/SaleModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// Create sale
export const createSale = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      throw new CustomError('User not authenticated', 401);
    }

    const { customer_id, items, payments } = req.body;

    // Validate input
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new CustomError('Sale must have at least one item', 400);
    }

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      throw new CustomError('Sale must have at least one payment', 400);
    }

    // Validate items
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
    };

    const sale = await SaleModel.create(userId, saleData);

    logger.info(`Sale created: ${sale.receipt_no} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: sale,
    });
  }
);

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











