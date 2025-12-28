import { Request, Response } from 'express';
import { StoreModel, StoreFilters } from '../models/StoreModel';
import { StoreSettingsModel, StoreSettingsInput } from '../models/StoreSettingsModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';

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

  // Update store (only existing columns)
  const store = await StoreModel.update(id, storeData);

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
    await StoreSettingsModel.createOrUpdate(id, settings);
  }

  // Fetch complete store with settings
  const completeStore = await StoreModel.findById(id);

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




