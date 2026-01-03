import { Request, Response } from 'express';
import { StoreModel, StoreFilters } from '../models/StoreModel';
import { StoreSettingsModel, StoreSettingsInput } from '../models/StoreSettingsModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const getStores = asyncHandler(async (req: Request, res: Response) => {
  const filters: StoreFilters = {
    search: req.query.search as string,
    is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  const result = await StoreModel.findAll(filters);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

export const getStoreById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const store = await StoreModel.findById(id);

  if (!store) {
    throw new CustomError('Store not found', 404);
  }

  res.json({
    success: true,
    data: store,
  });
});

export const createStore = asyncHandler(async (req: Request, res: Response) => {
  // Separate store data from settings data
  const {
    currency_code,
    tax_inclusive,
    theme,
    tax_rate,
    receipt_footer,
    auto_backup,
    backup_frequency,
    low_stock_threshold,
    show_stock,
    auto_add_qty,
    allow_negative,
    paper_size,
    auto_print,
    receipt_header,
    ...storeData
  } = req.body;

  // Create store
  const store = await StoreModel.create(storeData);

  // Create store settings if provided
  const settings: StoreSettingsInput = {
    currency_code,
    tax_inclusive,
    theme,
    tax_rate,
    receipt_footer,
    auto_backup,
    backup_frequency,
    low_stock_threshold,
    show_stock,
    auto_add_qty,
    allow_negative,
    paper_size,
    auto_print,
    receipt_header,
  };

  // Only create settings if at least one setting field is provided
  const hasSettings = Object.values(settings).some(value => value !== undefined);
  if (hasSettings) {
    await StoreSettingsModel.createOrUpdate(store.store_id, settings);
  }

  // Fetch complete store with settings
  const completeStore = await StoreModel.findById(store.store_id);

  res.status(201).json({
    success: true,
    data: completeStore,
  });
});

export const updateStore = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  logger.info(`[StoreController] Starting update for store ${id}`);
  const existing = await StoreModel.findById(id);

  if (!existing) {
    throw new CustomError('Store not found', 404);
  }

  // Separate store data from settings data
  const {
    currency_code,
    tax_inclusive,
    theme,
    tax_rate,
    receipt_footer,
    auto_backup,
    backup_frequency,
    low_stock_threshold,
    show_stock,
    auto_add_qty,
    allow_negative,
    paper_size,
    auto_print,
    receipt_header,
    ...storeData
  } = req.body;

  logger.info(`[StoreController] Updating store fields for ${id}`);
  // Update store (only existing columns)
  const store = await StoreModel.update(id, storeData);
  logger.info(`[StoreController] Store fields updated for ${id}`);

  // Update store settings if provided
  const settings: StoreSettingsInput = {
    currency_code,
    tax_inclusive,
    theme,
    tax_rate,
    receipt_footer,
    auto_backup,
    backup_frequency,
    low_stock_threshold,
    show_stock,
    auto_add_qty,
    allow_negative,
    paper_size,
    auto_print,
    receipt_header,
  };

  // Only update settings if at least one setting field is provided
  const hasSettings = Object.values(settings).some(value => value !== undefined);
  if (hasSettings) {
    logger.info(`[StoreController] Updating store settings for ${id}`);
    await StoreSettingsModel.createOrUpdate(id, settings);
    logger.info(`[StoreController] Store settings updated for ${id}`);
  }

  logger.info(`[StoreController] Fetching complete store for ${id}`);
  // Fetch complete store with settings
  const completeStore = await StoreModel.findById(id);

  logger.info(`[StoreController] Store update complete for ${id}`);
  res.json({
    success: true,
    data: completeStore,
  });
});

export const deleteStore = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = await StoreModel.delete(id);

  if (!deleted) {
    throw new CustomError('Store not found', 404);
  }

  res.json({
    success: true,
    message: 'Store deleted successfully',
  });
});

// Get store settings (public endpoint for all authenticated users)
export const getStoreSettings = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const store = await StoreModel.findById(id);

  if (!store) {
    throw new CustomError('Store not found', 404);
  }

  res.json({
    success: true,
    data: store, // This includes store settings
  });
});

// Get default store (public endpoint for all authenticated users)
export const getDefaultStore = asyncHandler(async (req: Request, res: Response) => {
  const result = await StoreModel.findAll({ is_active: true, limit: 1 });

  if (result.data.length === 0) {
    throw new CustomError('No active store found', 404);
  }

  res.json({
    success: true,
    data: result.data[0], // Returns first active store with settings
  });
});




