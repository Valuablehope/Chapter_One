import { ReportModel } from '../models/ReportModel';
import { SaleModel } from '../models/SaleModel';
import { logger } from '../utils/logger';
import { CONVEX_SITE_URL } from './convexClient';

const INGEST_ENDPOINT = `${CONVEX_SITE_URL}/mobile/dashboard/ingest`;
const SAFETY_NET_INTERVAL_MS = 5 * 60 * 1000; // covers any event we didn't explicitly hook
const DEBOUNCE_MS = 3_000; // collapse bursts of events (several sales in a row) into one push
const LOW_STOCK_THRESHOLD = 10;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function buildSnapshot(storeId: string) {
  const today = todayDateString();

  const [salesSummary, topProducts, lowStock] = await Promise.all([
    ReportModel.getSalesSummary({ start_date: today, end_date: today, store_id: storeId, limit: 1 }),
    ReportModel.getProductSales({ start_date: today, end_date: today, store_id: storeId, limit: 5 }),
    ReportModel.getLowStockReport(storeId, LOW_STOCK_THRESHOLD, undefined, 1, 10),
  ]);

  const todaySummary = salesSummary[0];

  return {
    storeId,
    todaySalesTotal: Number(todaySummary?.total_revenue ?? 0),
    todayTransactionCount: Number(todaySummary?.transaction_count ?? 0),
    topProducts: topProducts.map((p) => ({
      name: p.product_name,
      quantitySold: Number(p.total_quantity),
      revenue: Number(p.total_revenue),
    })),
    lowStockItems: lowStock.data.map((i) => ({
      name: i.product_name,
      quantity: Number(i.qty_on_hand),
      reorderLevel: i.min_threshold,
    })),
    generatedAt: Date.now(),
  };
}

async function pushSnapshot(): Promise<void> {
  try {
    const store = await SaleModel.getDefaultStore();
    if (!store) return;

    const snapshot = await buildSnapshot(store.store_id);

    const response = await fetch(INGEST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(10_000),
    });

    // A non-OK response here just means the store hasn't purchased the
    // add-on (or the license lapsed) -- Convex rejects the ingest. That's
    // expected/frequent for most installs, so it's not worth logging.
    if (!response.ok && response.status !== 403) {
      logger.warn(`Dashboard snapshot ingest returned HTTP ${response.status}`);
    }
  } catch (err) {
    logger.warn('Dashboard snapshot push failed:', err);
  }
}

let debounceTimer: NodeJS.Timeout | null = null;

/**
 * Call after anything that should update the mobile dashboard soon (a sale,
 * a day closure). Debounced so a burst of events collapses into one push.
 */
export function scheduleSnapshotPush(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void pushSnapshot(), DEBOUNCE_MS);
}

/**
 * Starts the safety-net timer (catches anything scheduleSnapshotPush()
 * wasn't hooked into) and pushes once immediately on boot. Cheap no-op for
 * stores without the Mobile Companion add-on -- Convex just 403s the push.
 */
export function startDashboardSnapshotService(): void {
  void pushSnapshot();
  setInterval(() => void pushSnapshot(), SAFETY_NET_INTERVAL_MS);
  logger.info('Dashboard snapshot service started');
}
