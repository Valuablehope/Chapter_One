import { SaleModel } from '../models/SaleModel';
import { verifyCredentials } from '../controllers/authController';
import { generateToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { CONVEX_SITE_URL } from './convexClient';

const POLL_INTERVAL_MS = 5_000;
const PENDING_ENDPOINT = `${CONVEX_SITE_URL}/mobile/login/pending`;
const RESOLVE_ENDPOINT = `${CONVEX_SITE_URL}/mobile/login/resolve`;

interface PendingMobileLoginRequest {
  requestId: string;
  username: string;
  password: string;
  deviceId: string;
  deviceName?: string;
}

async function fetchPendingRequests(storeId: string): Promise<PendingMobileLoginRequest[]> {
  const url = `${PENDING_ENDPOINT}?storeId=${encodeURIComponent(storeId)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return [];
  const data = (await response.json()) as any;
  return Array.isArray(data?.requests) ? data.requests : [];
}

async function resolveRequest(requestId: string, body: Record<string, unknown>): Promise<void> {
  await fetch(RESOLVE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, ...body }),
    signal: AbortSignal.timeout(10_000),
  });
}

async function handleRequest(request: PendingMobileLoginRequest): Promise<void> {
  const result = await verifyCredentials(request.username, request.password);

  if (!result.ok) {
    logger.warn(`Mobile companion login denied for username: ${request.username} (${result.reason})`);
    await resolveRequest(request.requestId, {
      approved: false,
      errorMessage: result.reason === 'INACTIVE' ? 'Account is deactivated' : 'Invalid username or password',
    });
    return;
  }

  const { user } = result;
  const sessionToken = generateToken({
    userId: user.userId,
    username: user.username,
    role: user.role,
    scope: 'mobile',
  });

  logger.info(`Mobile companion login approved for user: ${user.username} (device: ${request.deviceId})`);

  await resolveRequest(request.requestId, {
    approved: true,
    userId: user.userId,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    sessionToken,
  });
}

async function tick(): Promise<void> {
  try {
    const store = await SaleModel.getDefaultStore();
    if (!store) return;

    const pending = await fetchPendingRequests(store.store_id);
    for (const request of pending) {
      await handleRequest(request);
    }
  } catch (err) {
    logger.warn('Mobile login relay tick failed:', err);
  }
}

/**
 * Brokers mobile-app logins through Convex without ever storing store
 * credentials in the cloud: polls for pending login handshakes created by
 * the mobile app for this store, verifies them locally against app_users
 * (the same check the desktop login route uses), and resolves the
 * handshake with a scoped session token. No-op (cheap poll, no matches)
 * for stores that haven't purchased the Mobile Companion add-on, since
 * Convex only ever creates a pending request when the add-on is entitled.
 */
export function startMobileLoginRelay(): void {
  let running = false;

  setInterval(() => {
    if (running) return;
    running = true;
    void tick().finally(() => {
      running = false;
    });
  }, POLL_INTERVAL_MS);

  logger.info('Mobile companion login relay started');
}
