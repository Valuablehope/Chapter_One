import { Request, Response } from 'express';
import { ProductModel, ProductFilters, ProductWithDetails } from '../models/ProductModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { body, query } from 'express-validator';

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const filters: ProductFilters = {
    search: req.query.search as string,
    product_type: req.query.product_type as string,
    track_inventory: req.query.track_inventory === 'true' ? true : 
                     req.query.track_inventory === 'false' ? false : undefined,
    pos_category_only: req.query.pos_category_only === 'true' ? true : undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  const result = await ProductModel.findAll(filters);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const product = await ProductModel.findById(id);

  if (!product) {
    throw new CustomError('Product not found', 404);
  }

  res.json({
    success: true,
    data: product,
  });
});

export const getProductByBarcode = asyncHandler(async (req: Request, res: Response) => {
  const { barcode } = req.params;
  const product = await ProductModel.findByBarcode(barcode);

  if (!product) {
    throw new CustomError('Product not found', 404);
  }

  res.json({
    success: true,
    data: product,
  });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const productData = req.body;

  // Check barcode uniqueness if provided
  if (productData.barcode) {
    const isUnique = await ProductModel.checkBarcodeUnique(productData.barcode);
    if (!isUnique) {
      throw new CustomError('Barcode already exists', 400);
    }
  }

  const product = await ProductModel.create(productData);
  res.status(201).json({
    success: true,
    data: product,
  });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  // Check if product exists
  const existing = await ProductModel.findById(id);
  if (!existing) {
    throw new CustomError('Product not found', 404);
  }

  // Check barcode uniqueness if being updated
  if (updates.barcode && updates.barcode !== existing.barcode) {
    const isUnique = await ProductModel.checkBarcodeUnique(updates.barcode, id);
    if (!isUnique) {
      throw new CustomError('Barcode already exists', 400);
    }
  }

  const product = await ProductModel.update(id, updates);
  res.json({
    success: true,
    data: product,
  });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deleted = await ProductModel.delete(id);

    if (!deleted) {
      throw new CustomError('Product not found', 404);
    }

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error: any) {
    // Check if it's a transaction error
    if (error.message && error.message.includes('Cannot delete product that has existing transactions')) {
      throw new CustomError(error.message, 400);
    }
    throw error;
  }
});

export const validateBarcode = asyncHandler(async (req: Request, res: Response) => {
  const { barcode } = req.body;
  const excludeProductId = req.body.exclude_product_id;

  if (!barcode) {
    throw new CustomError('Barcode is required', 400);
  }

  const isUnique = await ProductModel.checkBarcodeUnique(barcode, excludeProductId);
  res.json({
    success: true,
    data: {
      barcode,
      isUnique,
    },
  });
});




