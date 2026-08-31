import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { LicenseModel } from '../models/LicenseModel';
import { SaleModel } from '../models/SaleModel';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { pool } from '../config/database';
import { activateLicenseKey, LicenseActivationResult } from '../services/convexClient';

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
        storeId: null,
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
      storeId,
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

  // Validate + atomically consume against Convex — isValid is only ever true
  // for a key that exists, is currently "active", and was just flipped to
  // "consumed" by this call. Same key can never succeed a second time.
  let result: LicenseActivationResult;
  try {
    result = await activateLicenseKey(key, { storeId: store.store_id });
  } catch (err: any) {
    throw new CustomError(err.message || 'Could not reach activation server', 503);
  }

  if (!result.isValid) {
    throw new CustomError('Invalid or already used license key.', 400);
  }

  // Derive prefix from key format: CH1-XXXX-XXXX-XXXX-XXXX → CH1-XXXX-XXXX
  const segments     = key.split('-');
  const licensePrefix = segments.slice(0, 3).join('-');  // e.g. "CH1-ABCD-EFGH"
  const keyHash        = createHash('sha256').update(key).digest('hex');

  // Duration/plan come from the license record itself (set when it was
  // generated in the admin panel). Fall back to the historical 1-year/yearly
  // defaults only if Convex didn't send them (e.g. mid-rollout, older deploy).
  const validityDays = result.validityDays ?? 365;
  const plan          = result.plan ?? 'yearly';

  const validFrom  = new Date();
  const validUntil = new Date(validFrom.getTime() + validityDays * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO licenses (
       store_id, license_prefix, plan, status,
       valid_from, valid_until, activated_at, license_payload_hash
     ) VALUES ($1, $2, $3, 'active', $4, $5, NOW(), $6)
     ON CONFLICT ON CONSTRAINT licenses_store_id_unique DO UPDATE SET
       license_prefix        = EXCLUDED.license_prefix,
       plan                  = EXCLUDED.plan,
       status                = 'active',
       valid_from            = EXCLUDED.valid_from,
       valid_until           = EXCLUDED.valid_until,
       activated_at          = NOW(),
       license_payload_hash  = EXCLUDED.license_payload_hash,
       updated_at            = NOW()`,
    [store.store_id, licensePrefix, plan, validFrom, validUntil, keyHash]
  );

  res.json({
    success: true,
    data: {
      message:    'License activated successfully.',
      validUntil: validUntil.toISOString(),
      plan,
      validFrom:  validFrom.toISOString(),
    },
  });
});





