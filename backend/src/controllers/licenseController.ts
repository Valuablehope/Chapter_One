import { Request, Response } from 'express';
import { LicenseModel } from '../models/LicenseModel';
import { SaleModel } from '../models/SaleModel';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { pool } from '../config/database';
import { activateLicenseKey } from '../services/convexClient';

// Get license status and record counts
export const getLicenseInfo = asyncHandler(async (req: Request, res: Response) => {
  const store = await SaleModel.getDefaultStore();
  if (!store) {
    return res.json({
      success: true,
      data: {
        hasLicense: false,
        isTrial: false,
        recordCounts: null,
        licenseStatus: null,
        limits: null,
      },
    });
  }

  const storeId = store.store_id;
  const licenseStatus = await LicenseModel.getLicenseStatus(storeId);
  const recordCounts = await LicenseModel.getRecordCounts(storeId);
  const limits = licenseStatus?.isTrial ? LicenseModel.getTrialLimits() : null;

  res.json({
    success: true,
    data: {
      hasLicense: !!licenseStatus,
      licenseStatus,
      recordCounts,
      limits,
    },
  });
});

// Activate license via Convex HTTP endpoint — validates remotely, saves locally
export const convexActivateLicense = asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey } = req.body;

  if (!licenseKey || !String(licenseKey).trim()) {
    throw new CustomError('License key is required', 400);
  }

  const key = String(licenseKey).trim().toUpperCase();

  const store = await SaleModel.getDefaultStore();
  if (!store) {
    throw new CustomError('No store configured on this device', 400);
  }

  // Validate against Convex — returns true (valid) or false (invalid/used/suspended)
  let isValid: boolean;
  try {
    isValid = await activateLicenseKey(key);
  } catch (err: any) {
    throw new CustomError(err.message || 'Could not reach activation server', 503);
  }

  if (!isValid) {
    throw new CustomError('Invalid or already used license key.', 400);
  }

  // Derive prefix from key format: CH1-XXXX-XXXX-XXXX-XXXX → CH1-XXXX-XXXX
  const segments     = key.split('-');
  const licensePrefix = segments.slice(0, 3).join('-');  // e.g. "CH1-ABCD-EFGH"

  const validFrom  = new Date();
  const validUntil = new Date(validFrom.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

  await pool.query(
    `INSERT INTO licenses (
       store_id, license_prefix, plan, status,
       valid_from, valid_until, activated_at
     ) VALUES ($1, $2, 'yearly', 'active', $3, $4, NOW())
     ON CONFLICT ON CONSTRAINT licenses_store_id_unique DO UPDATE SET
       license_prefix = EXCLUDED.license_prefix,
       plan           = 'yearly',
       status         = 'active',
       valid_from     = EXCLUDED.valid_from,
       valid_until    = EXCLUDED.valid_until,
       activated_at   = NOW(),
       updated_at     = NOW()`,
    [store.store_id, licensePrefix, validFrom, validUntil]
  );

  res.json({
    success: true,
    data: {
      message:    'License activated successfully.',
      validUntil: validUntil.toISOString(),
      plan:       'yearly',
      validFrom:  validFrom.toISOString(),
    },
  });
});





