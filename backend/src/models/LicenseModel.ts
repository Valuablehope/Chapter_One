import { BaseModel } from './BaseModel';
import { pool } from '../config/database';
import { SaleModel } from './SaleModel';

export interface License {
  license_id: string;
  store_id: string;
  license_key: string | null;
  valid: boolean;
  customer_name: string | null;
  customer_email: string | null;
  subscription_type: 'trial' | 'yearly' | 'lifetime';
  status: 'active' | 'expired' | 'suspended';
  start_date: string;
  expiry_date: string;
  max_devices: number;
  created_at: string;
  updated_at: string;
}

export interface LicenseStatus {
  isValid: boolean;
  subscriptionType: 'trial' | 'yearly' | 'lifetime';
  status: 'active' | 'expired' | 'suspended';
  expiryDate: string;
  daysRemaining: number;
  isTrial: boolean;
  isExpired: boolean;
}

export interface RecordCounts {
  products: number;
  customers: number;
  sales: number;
  purchases: number;
  suppliers: number;
  users: number;
}

// Trial limits configuration
const TRIAL_LIMITS = {
  products: 50,
  customers: 50,
  sales: 100,
  purchases: 50,
  suppliers: 10,
  users: 3,
};

export class LicenseModel extends BaseModel {
  static async findByStoreId(storeId: string): Promise<License | null> {
    const query = `
      SELECT * FROM licenses 
      WHERE store_id = $1
    `;
    const result = await this.query<License>(query, [storeId]);
    return result.rows[0] || null;
  }

  static async findByLicenseKey(licenseKey: string): Promise<License | null> {
    // First, try direct lookup (for backward compatibility with unencrypted keys)
    let query = `
      SELECT * FROM licenses 
      WHERE license_key = $1
    `;
    let result = await this.query<License>(query, [licenseKey]);
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    // If not found, try to find by decrypting encrypted keys
    // This uses the decrypt_license_key function from the SQL script
    try {
      query = `
        SELECT 
          license_id,
          store_id,
          license_key,
          valid,
          customer_name,
          customer_email,
          subscription_type,
          status,
          start_date,
          expiry_date,
          max_devices,
          created_at,
          updated_at
        FROM licenses 
        WHERE license_key IS NOT NULL 
          AND license_key != ''
          AND length(license_key) > 20
          AND decrypt_license_key(license_key) = $1
      `;
      
      result = await this.query<License>(query, [licenseKey]);
      
      if (result.rows.length > 0) {
        return result.rows[0];
      }
    } catch (error: any) {
      // If the decrypt function doesn't exist or fails, try alternative method
      // This can happen if the SQL script hasn't been run yet
      console.error('[LicenseModel] Error using decrypt_license_key function:', error.message);
      console.error('[LicenseModel] Make sure you have run the updated generate_license_key.sql script');
      
      // Fallback: Try to encrypt the input key and search for it
      // NOTE: This may not work perfectly due to differences between PostgreSQL and Node.js encryption
      // The primary method (using decrypt_license_key SQL function) should be used
      // Make sure to run the generate_license_key.sql script to create the decrypt function
      const encryptionKey = (process.env.LICENSE_ENCRYPTION_KEY || 'ChapterOneLicenseKey2024!SecureEncryptionKey12345678').substring(0, 32);
      
      if (!process.env.LICENSE_ENCRYPTION_KEY) {
        console.warn('[LicenseModel] LICENSE_ENCRYPTION_KEY not set in environment variables. Using default key (NOT SECURE FOR PRODUCTION)');
      }
      
      try {
        const crypto = require('crypto');
        
        // PostgreSQL's encrypt function with 'aes' uses a specific format
        // We'll try to match it, but this may not be 100% compatible
        // The SQL decrypt function is the recommended approach
        const cipher = crypto.createCipheriv('aes-256-ecb', Buffer.from(encryptionKey), Buffer.alloc(0));
        cipher.setAutoPadding(true);
        
        let encrypted = cipher.update(licenseKey, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        query = `SELECT * FROM licenses WHERE license_key = $1`;
        result = await this.query<License>(query, [encrypted]);
        
        if (result.rows.length > 0) {
          return result.rows[0];
        }
      } catch (encryptError: any) {
        // If encryption fails (e.g., ECB mode not supported), log and continue
        console.error('[LicenseModel] Encryption fallback failed:', encryptError.message);
      }
    }
    
    return null;
  }

  static async getLicenseStatus(storeId: string): Promise<LicenseStatus | null> {
    const license = await this.findByStoreId(storeId);
    if (!license) {
      return null;
    }

    const now = new Date();
    const expiryDate = new Date(license.expiry_date);
    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isExpired = expiryDate < now;
    
    // If yearly/lifetime license has expired, automatically convert to trial
    if (isExpired && (license.subscription_type === 'yearly' || license.subscription_type === 'lifetime')) {
      // Update license to trial mode automatically
      const newExpiryDate = new Date();
      newExpiryDate.setDate(newExpiryDate.getDate() + 30); // 30-day trial period
      const newExpiryDateStr = newExpiryDate.toISOString().split('T')[0];
      
      try {
        await this.query(
          `UPDATE licenses 
           SET subscription_type = 'trial',
               status = 'active',
               valid = true,
               start_date = CURRENT_DATE,
               expiry_date = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE store_id = $2`,
          [newExpiryDateStr, storeId]
        );
        
        // Return trial status
        return {
          isValid: true,
          subscriptionType: 'trial',
          status: 'active',
          expiryDate: newExpiryDateStr,
          daysRemaining: 30,
          isTrial: true,
          isExpired: false,
        };
      } catch (error) {
        // If update fails, log and continue with expired status
        console.error('[LicenseModel] Failed to convert expired license to trial:', error);
      }
    }
    
    const isValid = license.valid && license.status === 'active' && !isExpired;
    const isTrial = license.subscription_type === 'trial';

    return {
      isValid,
      subscriptionType: license.subscription_type,
      status: isExpired ? 'expired' : license.status,
      expiryDate: license.expiry_date,
      daysRemaining: Math.max(0, daysRemaining),
      isTrial,
      isExpired,
    };
  }

  static async getRecordCounts(storeId: string): Promise<RecordCounts> {
    // Get counts directly from tables
    const queries = {
      products: 'SELECT COUNT(*) as count FROM products',
      customers: 'SELECT COUNT(*) as count FROM customers',
      sales: 'SELECT COUNT(*) as count FROM sales WHERE store_id = $1',
      purchases: 'SELECT COUNT(*) as count FROM purchase_orders WHERE store_id = $1',
      suppliers: 'SELECT COUNT(*) as count FROM suppliers',
      users: 'SELECT COUNT(*) as count FROM app_users',
    };

    const [products, customers, sales, purchases, suppliers, users] = await Promise.all([
      this.query(queries.products, []),
      this.query(queries.customers, []),
      this.query(queries.sales, [storeId]),
      this.query(queries.purchases, [storeId]),
      this.query(queries.suppliers, []),
      this.query(queries.users, []),
    ]);

    return {
      products: parseInt(products.rows[0].count, 10),
      customers: parseInt(customers.rows[0].count, 10),
      sales: parseInt(sales.rows[0].count, 10),
      purchases: parseInt(purchases.rows[0].count, 10),
      suppliers: parseInt(suppliers.rows[0].count, 10),
      users: parseInt(users.rows[0].count, 10),
    };
  }

  static async checkRecordLimit(
    storeId: string,
    recordType: 'products' | 'customers' | 'sales' | 'purchases' | 'suppliers' | 'users'
  ): Promise<{ allowed: boolean; current: number; limit: number; message?: string }> {
    const license = await this.findByStoreId(storeId);
    
    // If no license, allow (for backward compatibility or new installs)
    if (!license) {
      return { allowed: true, current: 0, limit: Infinity };
    }

    const licenseStatus = await this.getLicenseStatus(storeId);
    
    // If license is now trial (including converted from expired yearly), apply limits
    if (licenseStatus?.isTrial) {
      const counts = await this.getRecordCounts(storeId);
      const current = counts[recordType];
      const limit = TRIAL_LIMITS[recordType];

      if (current >= limit) {
        return {
          allowed: false,
          current,
          limit,
          message: `Trial limit reached: ${limit} ${recordType} maximum. Please upgrade to continue.`,
        };
      }

      return { allowed: true, current, limit };
    }
    
    // Yearly/lifetime subscriptions (active) have no limits
    if (licenseStatus && !licenseStatus.isTrial && licenseStatus.isValid) {
      return { allowed: true, current: 0, limit: Infinity };
    }

    // Default: allow
    return { allowed: true, current: 0, limit: Infinity };
  }

  static async activateDevice(
    storeId: string,
    licenseKey: string,
    deviceFingerprint: string,
    deviceName?: string,
    deviceInfo?: any
  ): Promise<{ success: boolean; message: string; license?: License }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      // Set transaction timeout (30 seconds) to prevent long-running transactions
      await client.query('SET LOCAL statement_timeout = 30000');

      // Find license by key
      const license = await this.findByLicenseKey(licenseKey);
      if (!license) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Invalid license key' };
      }

      // Check if license is valid
      const licenseStatus = await this.getLicenseStatus(license.store_id);
      if (!licenseStatus?.isValid) {
        await client.query('ROLLBACK');
        return { success: false, message: 'License is expired or invalid' };
      }

      // Check device limit
      const deviceCountQuery = `
        SELECT COUNT(*) as count 
        FROM device_activations 
        WHERE license_id = $1 AND is_active = true
      `;
      const deviceCountResult = await client.query(deviceCountQuery, [license.license_id]);
      const deviceCount = parseInt(deviceCountResult.rows[0].count, 10);

      if (deviceCount >= license.max_devices) {
        await client.query('ROLLBACK');
        return { success: false, message: `Maximum devices (${license.max_devices}) reached` };
      }

      // Check if device already activated
      const existingQuery = `
        SELECT * FROM device_activations 
        WHERE license_id = $1 AND device_fingerprint = $2
      `;
      const existingResult = await client.query(existingQuery, [license.license_id, deviceFingerprint]);

      if (existingResult.rows.length > 0) {
        // Update existing activation
        await client.query(
          `UPDATE device_activations 
           SET is_active = true, last_validated_at = CURRENT_TIMESTAMP,
               device_name = $1, device_info = $2
           WHERE license_id = $3 AND device_fingerprint = $4`,
          [deviceName || null, deviceInfo ? JSON.stringify(deviceInfo) : null, license.license_id, deviceFingerprint]
        );
      } else {
        // Create new activation
        await client.query(
          `INSERT INTO device_activations 
           (store_id, license_id, device_fingerprint, device_name, device_info)
           VALUES ($1, $2, $3, $4, $5)`,
          [license.store_id, license.license_id, deviceFingerprint, deviceName || null, deviceInfo ? JSON.stringify(deviceInfo) : null]
        );
      }

      // Log validation
      await client.query(
        `INSERT INTO license_validations 
         (store_id, license_id, device_fingerprint, validation_result, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [license.store_id, license.license_id, deviceFingerprint, 'Device activated successfully', 
         '127.0.0.1', 'Chapter One POS']
      );

      await client.query('COMMIT');
      return { success: true, message: 'Device activated successfully', license };
    } catch (error: any) {
      // Always rollback on error
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Log rollback error but don't mask original error
        console.error('Failed to rollback transaction:', rollbackError);
      }
      throw error;
    } finally {
      // Always release client, even if rollback failed
      try {
        client.release();
      } catch (releaseError) {
        // Log release error - this is critical
        console.error('Failed to release database client:', releaseError);
      }
    }
  }

  static async validateDevice(
    storeId: string,
    deviceFingerprint: string
  ): Promise<{ valid: boolean; license?: License; message: string }> {
    const license = await this.findByStoreId(storeId);
    if (!license) {
      return { valid: false, message: 'No license found for this store' };
    }

    const licenseStatus = await this.getLicenseStatus(storeId);
    if (!licenseStatus?.isValid) {
      return { valid: false, license, message: 'License is expired or invalid' };
    }

    // Check if device is activated
    const activationQuery = `
      SELECT * FROM device_activations 
      WHERE license_id = $1 AND device_fingerprint = $2 AND is_active = true
    `;
    const activationResult = await this.query(activationQuery, [license.license_id, deviceFingerprint]);

    if (activationResult.rows.length === 0) {
      return { valid: false, license, message: 'Device not activated for this license' };
    }

    // Update last validated timestamp
    await this.query(
      `UPDATE device_activations 
       SET last_validated_at = CURRENT_TIMESTAMP 
       WHERE license_id = $1 AND device_fingerprint = $2`,
      [license.license_id, deviceFingerprint]
    );

    return { valid: true, license, message: 'License valid' };
  }

  static getTrialLimits(): RecordCounts {
    return TRIAL_LIMITS;
  }
}

