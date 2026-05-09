import { logger } from '../utils/logger';

const ACTIVATE_ENDPOINT = 'https://wonderful-spider-492.eu-west-1.convex.site/activatelicense';

/**
 * Validates a license key against the Convex activation endpoint.
 * Returns true if the key is valid and unused, false otherwise.
 */
export async function activateLicenseKey(licenseKey: string): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(ACTIVATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license: licenseKey }),
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

  return await response.json() as boolean;
}
