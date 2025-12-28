import { Request, Response } from 'express';
import { LicenseModel } from '../models/LicenseModel';
import { SaleModel } from '../models/SaleModel';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { pool } from '../config/database';

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





