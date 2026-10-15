import './prelude';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import express, { App } from './shims/express';
import type { LocalRequestInit, LocalResponse } from './shims/express';
import { pool } from './shims/database';
import { MIGRATIONS } from './generated/migrations';

// The real backend, unchanged. Imported after the prelude has set process.env.
import apiRoutes from '../../backend/src/routes';
import authRoutes from '../../backend/src/routes/auth';
import productRoutes from '../../backend/src/routes/products';
import productTypesRoutes from '../../backend/src/routes/productTypes';
import customerRoutes from '../../backend/src/routes/customers';
import supplierRoutes from '../../backend/src/routes/suppliers';
import barcodeRoutes from '../../backend/src/routes/barcode';
import salesRoutes from '../../backend/src/routes/sales';
import purchasesRoutes from '../../backend/src/routes/purchases';
import reportsRoutes from '../../backend/src/routes/reports';
import adminRoutes from '../../backend/src/routes/admin';
import licenseRoutes from '../../backend/src/routes/license';
import stockRoutes from '../../backend/src/routes/stock';
import storesRoutes from '../../backend/src/routes/stores';
import menusRoutes from '../../backend/src/routes/menus';
import dayClosureRoutes from '../../backend/src/routes/dayClosure';
import openingStockRoutes from '../../backend/src/routes/openingStock';
import expensesRoutes from '../../backend/src/routes/expenses';
import disposeRoutes from '../../backend/src/routes/dispose';
import { errorHandler } from '../../backend/src/middleware/errorHandler';
import { sanitizeMiddleware } from '../../backend/src/utils/sanitize';
import { hashPassword } from '../../backend/src/utils/password';

export { pool };
export type { LocalRequestInit, LocalResponse };

export interface DeviceDbOptions {
  /** PGlite data dir: 'idb://chapter-one' on a device, omitted for an in-memory database (tests). */
  dataDir?: string;
}

/** Opens (creating if needed) the device database and applies any pending migrations. */
export async function openDeviceDatabase(opts: DeviceDbOptions = {}): Promise<PGlite> {
  const db = new PGlite({
    ...(opts.dataDir ? { dataDir: opts.dataDir } : {}),
    extensions: { pg_trgm, pgcrypto },
    // `pg` returns int8 (count(*), sums) as strings; models rely on that.
    parsers: { 20: (v: string) => v },
  });
  await db.waitReady;
  await db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)`);
  const done = new Set((await db.query<{ name: string }>('SELECT name FROM migrations')).rows.map((r) => r.name));
  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.query('INSERT INTO migrations (name) VALUES ($1)', [m.name]);
    });
  }
  pool.attach(db);
  return db;
}

export interface SetupInput {
  storeName: string;
  adminUsername: string;
  adminFullName?: string;
  adminPassword: string;
  mode: 'standalone' | 'linked';
}

/** First-run provisioning (the device equivalent of the desktop setup wizard). */
export async function setupDevice(input: SetupInput) {
  const existing = await pool.query('SELECT 1 FROM app_users LIMIT 1');
  if (existing.rowCount > 0) throw new Error('This device is already set up.');
  const store = (
    await pool.query(
      "INSERT INTO stores (code, name) VALUES ('MAIN', $1) ON CONFLICT (code) DO UPDATE SET name = $1 RETURNING store_id",
      [input.storeName]
    )
  ).rows[0];
  await pool.query(
    "INSERT INTO terminals (store_id, code, name, is_active) VALUES ($1, 'T1', 'This device', true)",
    [store.store_id]
  );
  const hash = await hashPassword(input.adminPassword);
  await pool.query(
    "INSERT INTO app_users (username, full_name, role, password_hash, is_active) VALUES ($1, $2, 'admin', $3, true)",
    [input.adminUsername, input.adminFullName || input.adminUsername, hash]
  );
  await pool.query('CREATE TABLE IF NOT EXISTS device_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  await pool.query(
    "INSERT INTO device_config (key, value) VALUES ('mode', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
    [input.mode]
  );
  return { storeId: store.store_id as string };
}

export async function isDeviceSetUp(): Promise<boolean> {
  const r = await pool.query('SELECT 1 FROM app_users LIMIT 1');
  return r.rowCount > 0;
}

/** Builds the API: the same routes the desktop backend mounts, served in-process. */
export function createLocalApi() {
  const app: App = express();
  app.use(sanitizeMiddleware);
  app.use('/api', apiRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/product-types', productTypesRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/suppliers', supplierRoutes);
  app.use('/api/barcode', barcodeRoutes);
  app.use('/api/sales', salesRoutes);
  app.use('/api/purchases', purchasesRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/license', licenseRoutes);
  app.use('/api/stock', stockRoutes);
  app.use('/api/stores', storesRoutes);
  app.use('/api/menus', menusRoutes);
  app.use('/api/day-closure', dayClosureRoutes);
  app.use('/api/opening-stock', openingStockRoutes);
  app.use('/api/expenses', expensesRoutes);
  app.use('/api/dispose', disposeRoutes);
  app.use(errorHandler);

  return {
    /** Serve one request. Requests run one at a time: the device has a single database connection. */
    request(init: LocalRequestInit): Promise<LocalResponse> {
      return pool.runExclusive(() => app.dispatch(init));
    },
  };
}
