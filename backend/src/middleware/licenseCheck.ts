import { Request, Response, NextFunction } from 'express';
import { LicenseModel } from '../models/LicenseModel';
import { SaleModel } from '../models/SaleModel';
import { CustomError } from './errorHandler';

// Get store_id from request (using default store)
async function getStoreId(): Promise<string | null> {
  const store = await SaleModel.getDefaultStore();
  return store?.store_id || null;
}

// Check if license is valid (allows trial and yearly)
export const checkLicense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const storeId = await getStoreId();
    if (!storeId) {
      return next(); // Allow if no store (for initial setup)
    }

    const licenseStatus = await LicenseModel.getLicenseStatus(storeId);
    
    if (!licenseStatus) {
      // No license - could be trial mode or new install
      return next();
    }

    if (!licenseStatus.isValid && licenseStatus.isExpired) {
      // Expired license - still allow read access but show warning
      (req as any).licenseStatus = licenseStatus;
      return next();
    }

    (req as any).licenseStatus = licenseStatus;
    next();
  } catch (error) {
    next(error);
  }
};

// Check record limit before creating records
export const checkRecordLimit = (recordType: 'products' | 'customers' | 'sales' | 'purchases' | 'suppliers' | 'users') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = await getStoreId();
      if (!storeId) {
        return next();
      }

      const limitCheck = await LicenseModel.checkRecordLimit(storeId, recordType);
      
      if (!limitCheck.allowed) {
        throw new CustomError(
          limitCheck.message || `Trial limit reached for ${recordType}`,
          403,
          {
            code: 'TRIAL_LIMIT_REACHED',
            limit: limitCheck.limit,
            current: limitCheck.current,
            recordType,
          }
        );
      }

      (req as any).recordLimit = limitCheck;
      next();
    } catch (error) {
      next(error);
    }
  };
};





