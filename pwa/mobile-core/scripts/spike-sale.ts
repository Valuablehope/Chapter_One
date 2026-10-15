/* Go/no-go spike: run the real backend SaleModel against PGlite through PglitePool. */
import path from 'path';
import fs from 'fs';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { PglitePool } from '../src/pglitePool';

const repo = path.resolve(__dirname, '../../');
const results: Record<string, string> = {};
const ok = (k: string, v: any = 'ok') => { results[k] = String(v); };

async function main() {
  // int8 (count(*), sums) comes back as a string from `pg`; keep that contract.
  const db = new PGlite({ extensions: { pg_trgm, pgcrypto }, parsers: { 20: (v: string) => v } });
  await db.waitReady;
  const dir = path.join(repo, 'database/migrations');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
  const pool = new PglitePool(db);

  // Make the backend models use the PGlite pool instead of pg.
  const dbModule = require.resolve(path.join(repo, 'backend/src/config/database.ts'));
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { pool, default: pool } } as any;

  const { SaleModel } = require(path.join(repo, 'backend/src/models/SaleModel.ts'));

  // Seed
  const store = (await pool.query("insert into stores(code,name) values ('S1','Test Store') returning store_id")).rows[0];
  const term = (await pool.query('insert into terminals(store_id,code,name) values ($1,\'T1\',\'Till 1\') returning terminal_id', [store.store_id])).rows[0];
  const user = (await pool.query("insert into app_users(username,full_name,role,password_hash) values ('admin','Admin','admin','x') returning user_id")).rows[0];
  const prod = (await pool.query("insert into products(name,sale_price,list_price,tax_rate) values ('Cola',10,6,0) returning product_id")).rows[0];
  const cols = (await pool.query("select column_name from information_schema.columns where table_name='stock_balances'")).rows.map((r: any) => r.column_name);
  ok('stock_balances columns', cols.join(','));
  const qtyCol = cols.includes('qty_on_hand') ? 'qty_on_hand' : cols.find((c: string) => /qty|quantity|on_hand/.test(c));
  await pool.query(`insert into stock_balances(store_id,product_id,${qtyCol}) values ($1,$2,50)`, [store.store_id, prod.product_id]);
  const stock = async () => Number((await pool.query(`select ${qtyCol} q from stock_balances where product_id=$1`, [prod.product_id])).rows[0].q);

  const t0 = Date.now();
  const sale = await SaleModel.create(user.user_id, {
    client_sale_id: 'spike-1',
    items: [{ product_id: prod.product_id, qty: 3, unit_price: 10, tax_rate: 0 }],
    payments: [{ method: 'cash', amount: 30 }],
  });
  ok('create sale', `${sale.receipt_no} total=${sale.grand_total} status=${sale.status} in ${Date.now() - t0}ms`);
  ok('stock after sale (50-3)', await stock());

  const dup = await SaleModel.create(user.user_id, {
    client_sale_id: 'spike-1',
    items: [{ product_id: prod.product_id, qty: 3, unit_price: 10, tax_rate: 0 }],
    payments: [{ method: 'cash', amount: 30 }],
  });
  ok('idempotent replay returns same sale', dup.sale_id === sale.sale_id);
  ok('stock unchanged after replay', await stock());

  const cancelled = await SaleModel.cancel(sale.sale_id, user.user_id);
  ok('cancel', `status=${cancelled.status}`);
  ok('stock after cancel (back to 50)', await stock());

  const list = await SaleModel.findAll({ page: 1, limit: 10 });
  ok('findAll total', list.pagination.total);

  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error('SPIKE FAILED:', e?.stack || e); console.log(JSON.stringify(results, null, 2)); process.exit(1); });
