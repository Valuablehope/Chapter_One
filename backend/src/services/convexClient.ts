import { logger } from '../utils/logger';

export const CONVEX_SITE_URL = 'https://wonderful-spider-492.eu-west-1.convex.site';
const ACTIVATE_ENDPOINT = `${CONVEX_SITE_URL}/activatelicense`;

export interface LicenseActivationResult {
  isValid: boolean;
  plan?: string;
  validityDays?: number;
}

export interface LicenseActivationMeta {
  storeId?: string;
  deviceId?: string;
  installationId?: string;
}

/**
 * Validates + atomically consumes a license key against the Convex activation
 * endpoint. Returns isValid: false if the key is invalid, unknown, or was
 * already consumed.
 */
export async function activateLicenseKey(
  licenseKey: string,
  meta: LicenseActivationMeta = {}
): Promise<LicenseActivationResult> {
  let response: Response;
  try {
    response = await fetch(ACTIVATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license: licenseKey,
        storeId: meta.storeId,
        deviceId: meta.deviceId,
        installationId: meta.installationId,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new Error('Activation server timed out. Check your internet connection and try again.');
    }
    throw new Error(`Cannot reach activation server: ${err?.message ?? 'network error'}`);
  }

  if (!response.ok) {
    logger.warn(`License activation endpoint returned HTTP ${response.status}`);
    throw new Error(`Activation server error (HTTP ${response.status}). Please try again.`);
  }

  const data = await response.json() as any;

  return {
    isValid: data?.isValid === true,
    plan: typeof data?.plan === 'string' ? data.plan : undefined,
    validityDays: typeof data?.validityDays === 'number' && data.validityDays > 0
      ? data.validityDays
      : undefined,
  };
}
