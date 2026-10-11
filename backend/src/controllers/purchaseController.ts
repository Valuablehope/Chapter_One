import { Request, Response, NextFunction } from 'express';
import { PurchaseOrderModel, CreatePurchaseOrderData, UpdatePurchaseOrderData, PurchaseOrderFilters, PurchaseOrderStatus } from '../models/PurchaseOrderModel';
import { pool } from '../config/database';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

interface PurchaseItemInput {
  product_id: string;
  qty_ordered: number;
  unit_cost: number;
}

// Shared by create and update. Coerces numerics (the API returns NUMERIC columns as strings,
// so a client round-tripping an edited PO sends "5.000"), rejects NaN/negatives, and checks
// every product exists with a single query.
async function validateAndNormalizeItems(items: any[]): Promise<PurchaseItemInput[]> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CustomError('Purchase order must have at least one item', 400);
  }

  const normalized = items.map((item): PurchaseItemInput => {
    const qty = Number(item?.qty_ordered);
    const cost = Number(item?.unit_cost);
    if (!item?.product_id || item.qty_ordered === undefined || item.unit_cost === undefined) {
      throw new CustomError('Each item must have product_id, qty_ordered, and unit_cost', 400);
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new CustomError('Item quantity must be greater than 0', 400);
    }
    if (!Number.isFinite(cost) || cost < 0) {
      throw new CustomError('Item unit cost must be a non-negative number', 400);
    }
    return { product_id: String(item.product_id), qty_ordered: qty, unit_cost: cost };
  });

  const ids = [...new Set(normalized.map((i) => i.product_id))];
  const found = await pool.query('SELECT product_id FROM products WHERE product_id = ANY($1::uuid[])', [ids]);
  const foundIds = new Set(found.rows.map((r) => r.product_id));
  const missing = ids.find((id) => !foundIds.has(id));
  if (missing) {
    throw new CustomError(`Product with ID ${missing} does not exist`, 400);
  }

  return normalized;
}

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
    const { supplier_id, expected_at, items, invoice_no } = req.body;

    // Validate input
    if (!supplier_id) {
      throw new CustomError('Supplier ID is required', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new CustomError('Purchase order must have at least one item', 400);
    }

    const validItems = await validateAndNormalizeItems(items);

    const purchaseOrderData: CreatePurchaseOrderData = {
      supplier_id,
      expected_at,
      items: validItems,
      invoice_no,
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
    const { supplier_id, expected_at, items, invoice_no } = req.body;

    // Validate items if provided
    let validItems: PurchaseItemInput[] | undefined;
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        throw new CustomError('Purchase order must have at least one item', 400);
      }
      validItems = await validateAndNormalizeItems(items);
    }

    const updateData: UpdatePurchaseOrderData = {
      supplier_id,
      expected_at,
      items: validItems,
      invoice_no,
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




