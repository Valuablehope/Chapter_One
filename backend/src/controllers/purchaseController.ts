import { Request, Response, NextFunction } from 'express';
import { PurchaseOrderModel, CreatePurchaseOrderData, UpdatePurchaseOrderData, PurchaseOrderFilters, PurchaseOrderStatus } from '../models/PurchaseOrderModel';
import { ProductModel } from '../models/ProductModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// Get all purchase orders
export const getPurchaseOrders = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const filters: PurchaseOrderFilters = {
      supplier_id: req.query.supplier_id as string,
      status: req.query.status as PurchaseOrderStatus,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };

    const result = await PurchaseOrderModel.findAll(filters);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

// Get purchase order by ID
export const getPurchaseOrderById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const purchaseOrder = await PurchaseOrderModel.findById(id);

    if (!purchaseOrder) {
      throw new CustomError('Purchase order not found', 404);
    }

    res.status(200).json({
      success: true,
      data: purchaseOrder,
    });
  }
);

// Create purchase order
export const createPurchaseOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { supplier_id, expected_at, items } = req.body;

    // Validate input
    if (!supplier_id) {
      throw new CustomError('Supplier ID is required', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new CustomError('Purchase order must have at least one item', 400);
    }

    // Validate items and check products exist
    for (const item of items) {
      if (!item.product_id || !item.qty_ordered || !item.unit_cost) {
        throw new CustomError('Each item must have product_id, qty_ordered, and unit_cost', 400);
      }
      if (item.qty_ordered <= 0) {
        throw new CustomError('Item quantity must be greater than 0', 400);
      }
      if (item.unit_cost < 0) {
        throw new CustomError('Item unit cost cannot be negative', 400);
      }

      // Validate that product exists
      const product = await ProductModel.findById(item.product_id);
      if (!product) {
        throw new CustomError(`Product with ID ${item.product_id} does not exist`, 400);
      }
    }

    const purchaseOrderData: CreatePurchaseOrderData = {
      supplier_id,
      expected_at,
      items,
    };

    const purchaseOrder = await PurchaseOrderModel.create(purchaseOrderData);

    logger.info(`Purchase order created: ${purchaseOrder.po_number}`);

    res.status(201).json({
      success: true,
      data: purchaseOrder,
    });
  }
);

// Update purchase order
export const updatePurchaseOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { supplier_id, expected_at, items } = req.body;

    // Validate items if provided
    if (items && Array.isArray(items)) {
      if (items.length === 0) {
        throw new CustomError('Purchase order must have at least one item', 400);
      }
      
      for (const item of items) {
        if (!item.product_id || !item.qty_ordered || !item.unit_cost) {
          throw new CustomError('Each item must have product_id, qty_ordered, and unit_cost', 400);
        }
        if (item.qty_ordered <= 0) {
          throw new CustomError('Item quantity must be greater than 0', 400);
        }
        if (item.unit_cost < 0) {
          throw new CustomError('Item unit cost cannot be negative', 400);
        }

        // Validate that product exists
        const product = await ProductModel.findById(item.product_id);
        if (!product) {
          throw new CustomError(`Product with ID ${item.product_id} does not exist`, 400);
        }
      }
    }

    const updateData: UpdatePurchaseOrderData = {
      supplier_id,
      expected_at,
      items,
    };

    const purchaseOrder = await PurchaseOrderModel.update(id, updateData);

    logger.info(`Purchase order ${id} updated`);

    res.status(200).json({
      success: true,
      data: purchaseOrder,
    });
  }
);

// Update purchase order status
export const updatePurchaseOrderStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['OPEN', 'PENDING', 'RECEIVED', 'CANCELLED'].includes(status)) {
      throw new CustomError('Invalid status. Must be OPEN, PENDING, RECEIVED, or CANCELLED', 400);
    }

    // Only Manager and Admin can change status to OPEN
    if (status === 'OPEN' && req.user && !['manager', 'admin'].includes(req.user.role)) {
      throw new CustomError('Forbidden: Only Manager and Admin can change purchase order status to OPEN', 403);
    }

    const purchaseOrder = await PurchaseOrderModel.updateStatus(
      id,
      status as PurchaseOrderStatus
    );

    logger.info(`Purchase order ${id} status updated to ${status}`);

    res.status(200).json({
      success: true,
      data: purchaseOrder,
    });
  }
);

// Receive purchase order
export const receivePurchaseOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const purchaseOrder = await PurchaseOrderModel.receivePurchaseOrder(id);

    logger.info(`Purchase order ${id} received and stock updated`);

    res.status(200).json({
      success: true,
      data: purchaseOrder,
    });
  }
);

// Delete purchase order
export const deletePurchaseOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    await PurchaseOrderModel.delete(id);

    logger.info(`Purchase order ${id} deleted`);

    res.status(200).json({
      success: true,
      message: 'Purchase order deleted successfully',
    });
  }
);




