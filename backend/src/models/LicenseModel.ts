import { BaseModel } from './BaseModel';

export interface License {
  license_id: string;
  store_id: string;
  device_id: string | null;
  installation_id: string | null;
  convex_subscription_id: string | null;
  convex_license_id: string | null;
  license_prefix: string | null;
  plan: string;
  status: 'active' | 'expired' | 'suspended';
  valid_from: string;
  valid_until: string;
  activated_at: string;
  customer_name: string | null;
  customer_email: string | null;
  company_name: string | null;
  store_name: string | null;
  license_payload_hash: string | null;
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

  static async getLicenseStatus(storeId: string): Promise<LicenseStatus | null> {
    const now = new Date();

    const license = await this.findByStoreId(storeId);
    if (!license) return null;

    const validUntil    = new Date(license.valid_until);
    const isExpired     = validUntil < now;
    const daysRemaining = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const plan          = (license.plan ?? 'yearly') as string;
    const subscriptionType: 'trial' | 'yearly' | 'lifetime' =
      plan === 'lifetime' ? 'lifetime' : plan === 'trial' ? 'trial' : 'yearly';
    const isTrial       = subscriptionType === 'trial';

    return {
      isValid: license.status === 'active' && !isExpired,
      subscriptionType,
      status: isExpired ? 'expired' : license.status,
      expiryDate: license.valid_until,
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

  static getTrialLimits(): RecordCounts {
    return TRIAL_LIMITS;
  }
}

