import { Request, Response } from 'express';
import { ScaleModel } from '../models/ScaleModel';
import { ProductModel } from '../models/ProductModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { getDriver, SCALE_BRAND_PRESETS } from '../services/scale/drivers';
import { parseScaleBarcode, computeScaleLine } from '../services/scale/barcodeParser';
import { logger } from '../utils/logger';

// ---------- Devices ----------

export const listDevices = asyncHandler(async (_req: Request, res: Response) => {
  const devices = await ScaleModel.listDevices();
  res.json({ success: true, data: devices });
});

export const createDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await ScaleModel.createDevice(req.body);
  res.status(201).json({ success: true, data: device });
});

export const updateDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await ScaleModel.updateDevice(req.params.id, req.body);
  if (!device) {
    throw new CustomError('Scale device not found', 404);
  }
  res.json({ success: true, data: device });
});

export const deleteDevice = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await ScaleModel.deleteDevice(req.params.id);
  if (!deleted) {
    throw new CustomError('Scale device not found', 404);
  }
  res.json({ success: true });
});

export const testDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await ScaleModel.getDevice(req.params.id);
  if (!device) {
    throw new CustomError('Scale device not found', 404);
  }
  const driver = getDriver(device.driver);
  const result = await driver.testConnection(device);
  res.json({ success: true, data: result });
});

export const syncDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await ScaleModel.getDevice(req.params.id);
  if (!device) {
    throw new CustomError('Scale device not found', 404);
  }

  const products = await ScaleModel.listPluProducts();
  if (products.length === 0) {
    throw new CustomError('No products have a PLU code assigned yet', 400);
  }

  const driver = getDriver(device.driver);
  try {
    const result = await driver.syncPlus(device, products);
    await ScaleModel.recordSyncResult(device.scale_id, 'success', result.message);
    logger.info('Scale PLU sync succeeded', {
      scaleId: device.scale_id,
      driver: device.driver,
      sent: result.sent,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    const message = err?.message || 'Sync failed';
    await ScaleModel.recordSyncResult(device.scale_id, 'error', message);
    logger.error('Scale PLU sync failed', { scaleId: device.scale_id, error: message });
    throw new CustomError(`Scale sync failed: ${message}`, 502);
  }
});

export const getPresets = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: SCALE_BRAND_PRESETS });
});

// ---------- Barcode formats ----------

export const listFormats = asyncHandler(async (_req: Request, res: Response) => {
  const formats = await ScaleModel.listFormats();
  res.json({ success: true, data: formats });
});

export const createFormat = asyncHandler(async (req: Request, res: Response) => {
  const format = await ScaleModel.createFormat(req.body);
  res.status(201).json({ success: true, data: format });
});

export const updateFormat = asyncHandler(async (req: Request, res: Response) => {
  const format = await ScaleModel.updateFormat(req.params.id, req.body);
  if (!format) {
    throw new CustomError('Barcode format not found', 404);
  }
  res.json({ success: true, data: format });
});

export const deleteFormat = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await ScaleModel.deleteFormat(req.params.id);
  if (!deleted) {
    throw new CustomError('Barcode format not found', 404);
  }
  res.json({ success: true });
});

// ---------- Utilities ----------

/**
 * Decode a scanned label against the active formats without touching a sale.
 * Used by the admin UI so the user can scan a real label from their scale and
 * immediately see how the POS will interpret it.
 */
export const testParse = asyncHandler(async (req: Request, res: Response) => {
  const { barcode } = req.body;
  const formats = await ScaleModel.listFormats(true);
  const parsed = parseScaleBarcode(barcode, formats);

  if (!parsed) {
    res.json({
      success: true,
      data: { matched: false, active_formats: formats.length },
    });
    return;
  }

  const product = await ProductModel.findByPluCode(parsed.plu_code);
  const unitPrice = product ? Number(product.sale_price || product.list_price || 0) : 0;

  res.json({
    success: true,
    data: {
      matched: true,
      parsed,
      product: product
        ? { product_id: product.product_id, name: product.name, sale_price: product.sale_price }
        : null,
      line: product ? computeScaleLine(parsed, unitPrice) : null,
    },
  });
});

/** List all products that carry a PLU code (the sync payload preview). */
export const listPluProducts = asyncHandler(async (_req: Request, res: Response) => {
  const products = await ScaleModel.listPluProducts();
  res.json({ success: true, data: products });
});

/** Download the PLU list as CSV without a configured device (universal export). */
export const exportPluCsv = asyncHandler(async (_req: Request, res: Response) => {
  const products = await ScaleModel.listPluProducts();
  const header = 'PLU,Name,Price,Unit,TaxRate';
  const lines = products.map((p) => {
    const name = `"${String(p.name).replace(/"/g, '""')}"`;
    const price = Number(p.sale_price || p.list_price || 0);
    return `${p.plu_code},${name},${price},${p.unit_of_measure || ''},${Number(p.tax_rate || 0)}`;
  });
  const csv = header + '\r\n' + lines.join('\r\n') + '\r\n';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="scale_plu_export.csv"');
  res.send(csv);
});
