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
    pos_module_type,
    restaurant_table_count,
    restaurant_track_guests_per_table,
    lbp_exchange_rate,
    label_show_lbp,
    label_store_name_size,
    label_product_name_size,
    label_lbp_size,
    label_price_size,
    label_header_align,
    label_header_font_weight,
    label_title_align,
    label_title_font_weight,
    label_lbp_row_align,
    label_lbp_prefix_size,
    label_lbp_prefix_weight,
    label_lbp_amount_weight,
    label_price_row_align,
    label_currency_size,
    label_currency_weight,
    label_price_amount_weight,
    label_section_order,
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
    pos_module_type,
    restaurant_table_count,
    restaurant_track_guests_per_table,
    lbp_exchange_rate,
    label_show_lbp,
    label_store_name_size,
    label_product_name_size,
    label_lbp_size,
    label_price_size,
    label_header_align,
    label_header_font_weight,
    label_title_align,
    label_title_font_weight,
    label_lbp_row_align,
    label_lbp_prefix_size,
    label_lbp_prefix_weight,
    label_lbp_amount_weight,
    label_price_row_align,
    label_currency_size,
    label_currency_weight,
    label_price_amount_weight,
    label_section_order,
  };

  // Only create settings if at least one setting field is provided
  const hasSettings = Object.values(settings).some(value => value !== undefined);
  if (hasSettings) {
    try {
      await StoreSettingsModel.createOrUpdate(store.store_id, settings);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('store_settings schema mismatch')) {
        throw new CustomError(message, 500, {
          suggestion: 'Run database migration for restaurant store_settings columns and restart backend.',
        });
      }
      throw err;
    }
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
    pos_module_type,
    restaurant_table_count,
    restaurant_track_guests_per_table,
    lbp_exchange_rate,
    label_show_lbp,
    label_store_name_size,
    label_product_name_size,
    label_lbp_size,
    label_price_size,
    label_header_align,
    label_header_font_weight,
    label_title_align,
    label_title_font_weight,
    label_lbp_row_align,
    label_lbp_prefix_size,
    label_lbp_prefix_weight,
    label_lbp_amount_weight,
    label_price_row_align,
    label_currency_size,
    label_currency_weight,
    label_price_amount_weight,
    label_section_order,
    ...storeData
  } = req.body;

  const rawStore = storeData as Partial<{
    code: string;
    name: string;
    address?: string;
    timezone?: string;
    is_active: boolean;
  }>;

  logger.info(
    `[StoreController] Store body keys present: code=${rawStore.code !== undefined}, name=${rawStore.name !== undefined}, address=${rawStore.address !== undefined}, timezone=${rawStore.timezone !== undefined}, is_active=${rawStore.is_active !== undefined}`
  );

  const mergedStorePayload = {
    code: rawStore.code !== undefined ? rawStore.code : existing.code,
    name: rawStore.name !== undefined ? rawStore.name : existing.name,
    address: rawStore.address !== undefined ? rawStore.address : existing.address,
    timezone: rawStore.timezone !== undefined ? rawStore.timezone : existing.timezone ?? 'UTC',
    is_active: rawStore.is_active !== undefined ? rawStore.is_active : existing.is_active,
  };

  logger.info(`[StoreController] Updating store fields for ${id}`);
  const store = await StoreModel.update(id, mergedStorePayload);
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
    pos_module_type,
    restaurant_table_count,
    restaurant_track_guests_per_table,
    lbp_exchange_rate,
    label_show_lbp,
    label_store_name_size,
    label_product_name_size,
    label_lbp_size,
    label_price_size,
    label_header_align,
    label_header_font_weight,
    label_title_align,
    label_title_font_weight,
    label_lbp_row_align,
    label_lbp_prefix_size,
    label_lbp_prefix_weight,
    label_lbp_amount_weight,
    label_price_row_align,
    label_currency_size,
    label_currency_weight,
    label_price_amount_weight,
    label_section_order,
  };

  // Only update settings if at least one setting field is provided
  const hasSettings = Object.values(settings).some(value => value !== undefined);
  if (hasSettings) {
    logger.info(`[StoreController] Updating store settings for ${id}`);
    try {
      await StoreSettingsModel.createOrUpdate(id, settings);
    } catch (err: unknown) {
      const pg = err as { code?: string; detail?: string; message?: string };
      if (pg.message?.includes('store_settings schema mismatch')) {
        throw new CustomError(pg.message, 500, {
          suggestion: 'Run database migration for restaurant store_settings columns and restart backend.',
        });
      }
      logger.error(`[StoreController] Store settings update failed for ${id}`, {
        pgCode: pg.code,
        pgDetail: pg.detail,
        message: pg.message,
      });
      throw err;
    }
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

/** Fields allowed on PATCH …/label-layout (shelf label appearance only). */
const LABEL_LAYOUT_PATCH_KEYS = [
  'label_show_lbp',
  'label_store_name_size',
  'label_product_name_size',
  'label_lbp_size',
  'label_price_size',
  'label_header_align',
  'label_header_font_weight',
  'label_title_align',
  'label_title_font_weight',
  'label_lbp_row_align',
  'label_lbp_prefix_size',
  'label_lbp_prefix_weight',
  'label_lbp_amount_weight',
  'label_price_row_align',
  'label_currency_size',
  'label_currency_weight',
  'label_price_amount_weight',
  'label_section_order',
] as const;

export const patchStoreLabelLayout = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await StoreModel.findById(id);
  if (!existing) {
    throw new CustomError('Store not found', 404);
  }

  const settings: StoreSettingsInput = {};
  for (const key of LABEL_LAYOUT_PATCH_KEYS) {
    if (req.body[key] !== undefined) {
      (settings as Record<string, unknown>)[key] = req.body[key];
    }
  }

  if (Object.keys(settings).length === 0) {
    throw new CustomError('No label layout fields in request body', 400);
  }

  await StoreSettingsModel.createOrUpdate(id, settings);
  const completeStore = await StoreModel.findById(id);
  res.json({
    success: true,
    data: completeStore,
  });
});


