import { Request, Response } from 'express';
import { LicenseModel } from '../models/LicenseModel';
import { SaleModel } from '../models/SaleModel';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { pool } from '../config/database';
import { validateDeviceFingerprint, generateServerSideFingerprint } from '../utils/deviceFingerprint';
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

// Activate license with key
export const activateLicense = asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey, deviceFingerprint, deviceName, deviceInfo } = req.body;
  const store = await SaleModel.getDefaultStore();

  if (!store) {
    throw new CustomError('No store found', 400);
  }

  if (!licenseKey || !deviceFingerprint) {
    throw new CustomError('License key and device fingerprint are required', 400);
  }

  // Validate device fingerprint format and detect tampering
  const fingerprintValidation = validateDeviceFingerprint(deviceFingerprint, deviceInfo);
  if (!fingerprintValidation.isValid) {
    throw new CustomError(`Invalid device fingerprint: ${fingerprintValidation.reason}`, 400);
  }

  // If deviceInfo is provided, generate server-side hash for additional validation
  if (deviceInfo) {
    const serverFingerprint = generateServerSideFingerprint(deviceInfo);
    // Log mismatch for security monitoring (but don't block if client fingerprint is valid)
    if (serverFingerprint !== deviceFingerprint) {
      console.warn('Device fingerprint mismatch detected - client and server hashes differ');
    }
  }

  const result = await LicenseModel.activateDevice(
    store.store_id,
    licenseKey,
    deviceFingerprint,
    deviceName,
    deviceInfo
  );

  if (!result.success) {
    throw new CustomError(result.message, 400);
  }

  res.json({
    success: true,
    data: {
      message: result.message,
      license: result.license,
    },
  });
});

// Validate device
export const validateDevice = asyncHandler(async (req: Request, res: Response) => {
  const { deviceFingerprint } = req.body;
  const store = await SaleModel.getDefaultStore();

  if (!store) {
    throw new CustomError('No store found', 400);
  }

  if (!deviceFingerprint) {
    throw new CustomError('Device fingerprint is required', 400);
  }

  // Validate device fingerprint format
  const fingerprintValidation = validateDeviceFingerprint(deviceFingerprint);
  if (!fingerprintValidation.isValid) {
    throw new CustomError(`Invalid device fingerprint: ${fingerprintValidation.reason}`, 400);
  }

  const result = await LicenseModel.validateDevice(store.store_id, deviceFingerprint);

  // Log validation attempt
  try {
    const license = await LicenseModel.findByStoreId(store.store_id);
    if (license) {
      await pool.query(
        `INSERT INTO license_validations 
         (store_id, license_id, device_fingerprint, validation_result, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          store.store_id,
          license.license_id,
          deviceFingerprint,
          result.valid ? 'Validation successful' : result.message,
          req.ip || '127.0.0.1',
          req.get('user-agent') || 'Chapter One POS',
        ]
      );
    }
  } catch (error) {
    // Don't fail if logging fails
    console.error('Failed to log validation:', error);
  }

  res.json({
    success: true,
    data: {
      valid: result.valid,
      message: result.message,
      license: result.license,
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





