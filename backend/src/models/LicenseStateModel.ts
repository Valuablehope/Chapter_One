import { pool } from '../config/database';
import { logger } from '../utils/logger';

export interface ConvexActivationResult {
  success: true;
  reason: 'LICENSE_ACTIVATED';
  plan: string;
  validityDays: number;
  validFrom: number;
  validUntil: number;
  storeId: string;
  deviceId?: string;
  installationId?: string;
  subscriptionId: string;
  licenseId: string;
  licensePrefix: string;
  customerName?: string;
  customerEmail?: string;
  companyName?: string;
  storeName?: string;
}

export interface LicenseState {
  id: string;
  store_id: string;
  device_id: string | null;
  installation_id: string | null;
  plan: string;
  status: string;
  valid_from: string;
  valid_until: string;
  last_activated_at: string;
  convex_subscription_id: string | null;
  last_convex_license_id: string | null;
  last_license_prefix: string | null;
  customer_name: string | null;
  customer_email: string | null;
  company_name: string | null;
  store_name: string | null;
  created_at: string;
  updated_at: string;
}

export class LicenseStateModel {
  static async upsertFromConvex(result: ConvexActivationResult): Promise<LicenseState> {
    const validFrom  = new Date(result.validFrom);
    const validUntil = new Date(result.validUntil);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const upsertResult = await client.query<LicenseState>(
        `INSERT INTO license_state (
           store_id, device_id, installation_id,
           plan, status, valid_from, valid_until, last_activated_at,
           convex_subscription_id, last_convex_license_id, last_license_prefix,
           customer_name, customer_email, company_name, store_name,
           updated_at
         ) VALUES ($1,$2,$3,$4,'active',$5,$6,NOW(),$7,$8,$9,$10,$11,$12,$13,NOW())
         ON CONFLICT (store_id) DO UPDATE SET
           device_id              = EXCLUDED.device_id,
           installation_id        = EXCLUDED.installation_id,
           plan                   = EXCLUDED.plan,
           status                 = 'active',
           valid_from             = EXCLUDED.valid_from,
           valid_until            = EXCLUDED.valid_until,
           last_activated_at      = NOW(),
           convex_subscription_id = EXCLUDED.convex_subscription_id,
           last_convex_license_id = EXCLUDED.last_convex_license_id,
           last_license_prefix    = EXCLUDED.last_license_prefix,
           customer_name          = EXCLUDED.customer_name,
           customer_email         = EXCLUDED.customer_email,
           company_name           = EXCLUDED.company_name,
           store_name             = EXCLUDED.store_name,
           updated_at             = NOW()
         RETURNING *`,
        [
          result.storeId,
          result.deviceId    ?? null,
          result.installationId ?? null,
          result.plan,
          validFrom,
          validUntil,
          result.subscriptionId,
          result.licenseId,
          result.licensePrefix,
          result.customerName  ?? null,
          result.customerEmail ?? null,
          result.companyName   ?? null,
          result.storeName     ?? null,
        ]
      );

      const saved = upsertResult.rows[0];

      // Also try to record in activation history (non-fatal if table doesn't exist yet)
      try {
        await client.query(
          `INSERT INTO license_activations (
             store_id, device_id, installation_id,
             convex_subscription_id, convex_license_id, license_prefix,
             plan, validity_days, valid_from, valid_until,
             activation_result
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'success')`,
          [
            result.storeId,
            result.deviceId    ?? null,
            result.installationId ?? null,
            result.subscriptionId,
            result.licenseId,
            result.licensePrefix,
            result.plan,
            result.validityDays,
            validFrom,
            validUntil,
          ]
        );
      } catch (histErr: any) {
        logger.warn('Could not write license_activations row:', histErr?.message);
      }

      // Keep the licenses table in sync for offline enforcement
      try {
        await client.query(
          `INSERT INTO licenses (
             store_id, device_id, installation_id,
             plan, status, valid_from, valid_until, activated_at,
             convex_subscription_id, convex_license_id, license_prefix,
             customer_name, customer_email, company_name, store_name
           ) VALUES ($1,$2,$3,$4,'active',$5,$6,NOW(),$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT ON CONSTRAINT licenses_store_id_unique DO UPDATE SET
             device_id              = EXCLUDED.device_id,
             installation_id        = EXCLUDED.installation_id,
             plan                   = EXCLUDED.plan,
             status                 = 'active',
             valid_from             = EXCLUDED.valid_from,
             valid_until            = EXCLUDED.valid_until,
             activated_at           = NOW(),
             convex_subscription_id = EXCLUDED.convex_subscription_id,
             convex_license_id      = EXCLUDED.convex_license_id,
             license_prefix         = EXCLUDED.license_prefix,
             customer_name          = EXCLUDED.customer_name,
             customer_email         = EXCLUDED.customer_email,
             company_name           = EXCLUDED.company_name,
             store_name             = EXCLUDED.store_name,
             updated_at             = NOW()`,
          [
            result.storeId,
            result.deviceId       ?? null,
            result.installationId ?? null,
            result.plan,
            validFrom,
            validUntil,
            result.subscriptionId,
            result.licenseId,
            result.licensePrefix,
            result.customerName  ?? null,
            result.customerEmail ?? null,
            result.companyName   ?? null,
            result.storeName     ?? null,
          ]
        );
      } catch (legacyErr: any) {
        logger.warn('Could not sync licenses row:', legacyErr?.message);
      }

      await client.query('COMMIT');
      return saved;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  static async getByStoreId(storeId: string): Promise<LicenseState | null> {
    const result = await pool.query<LicenseState>(
      `SELECT * FROM license_state WHERE store_id = $1`,
      [storeId]
    );
    return result.rows[0] ?? null;
  }

  static isActive(state: LicenseState): boolean {
    return state.status === 'active' && new Date(state.valid_until) > new Date();
  }
}
