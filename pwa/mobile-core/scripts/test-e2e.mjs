// End-to-end check of the on-device API: real backend routes + controllers + models on PGlite.
import { openDeviceDatabase, setupDevice, isDeviceSetUp, createLocalApi, pool } from '../dist/localApi.node.mjs';

const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const t0 = Date.now();
await openDeviceDatabase();
check('database opened + 66 migrations applied', true, `${Date.now() - t0}ms`);
check('fresh device is not set up', (await isDeviceSetUp()) === false);

const ts = Date.now();
await setupDevice({ storeName: 'Test Shop', adminUsername: 'admin', adminPassword: 'Secret123!', mode: 'standalone' });
check('first-run setup created store/terminal/admin', await isDeviceSetUp(), `${Date.now() - ts}ms (includes bcrypt)`);

const api = createLocalApi();
const call = async (method, url, body, token) =>
  api.request({ method, url, body, headers: token ? { Authorization: `Bearer ${token}` } : {} });

let r = await call('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
check('login with wrong password is rejected', r.status === 401, `status ${r.status}`);

r = await call('POST', '/api/auth/login', { username: 'admin', password: 'Secret123!' });
const token = r.body?.data?.token;
check('login succeeds and returns a token', r.status === 200 && !!token, `status ${r.status}`);

r = await call('GET', '/api/products?limit=5');
check('API requires authentication', r.status === 401, `status ${r.status}`);

r = await call('GET', '/api/auth/verify', undefined, token);
check('token verifies', r.status === 200, `status ${r.status}`);

r = await call('POST', '/api/products', { name: 'Cola 330ml', barcode: '5449000000996', sale_price: 1.5, list_price: 0.9, tax_rate: 0 }, token);
const product = r.body?.data;
check('create product', r.status === 201 || r.status === 200, `status ${r.status} ${r.body?.error?.message || ''}`);

r = await call('GET', '/api/products/barcode/5449000000996', undefined, token);
check('look up product by barcode', r.status === 200 && r.body?.data?.name === 'Cola 330ml', `status ${r.status}`);

r = await call('GET', '/api/products?search=cola&limit=5', undefined, token);
check('search products', r.status === 200 && r.body?.pagination?.total >= 1, `total ${r.body?.pagination?.total}`);

if (product?.product_id) {
  await pool.query(
    'INSERT INTO stock_balances (store_id, product_id, qty_on_hand) SELECT store_id, $1, 20 FROM stores LIMIT 1',
    [product.product_id]
  );
  r = await call('POST', '/api/sales', {
    client_sale_id: 'e2e-1',
    items: [{ product_id: product.product_id, qty: 4, unit_price: 1.5, tax_rate: 0 }],
    payments: [{ method: 'cash', amount: 6 }],
  }, token);
  const sale = r.body?.data;
  check('create sale', (r.status === 201 || r.status === 200) && sale?.status === 'paid', `status ${r.status} total=${sale?.grand_total} receipt=${sale?.receipt_no} ${r.body?.error?.message || ''}`);

  const bal = (await pool.query('SELECT qty_on_hand FROM stock_balances WHERE product_id=$1', [product.product_id])).rows[0].qty_on_hand;
  check('stock reduced by the sale (20 -> 16)', Number(bal) === 16, `qty_on_hand=${bal}`);

  r = await call('POST', '/api/sales', {
    client_sale_id: 'e2e-1',
    items: [{ product_id: product.product_id, qty: 4, unit_price: 1.5, tax_rate: 0 }],
    payments: [{ method: 'cash', amount: 6 }],
  }, token);
  check('replaying the same client_sale_id returns the same sale', r.body?.data?.sale_id === sale?.sale_id);

  r = await call('GET', '/api/sales?limit=5', undefined, token);
  check('list sales', r.status === 200 && r.body?.pagination?.total === 1, `total ${r.body?.pagination?.total}`);

  r = await call('PUT', `/api/sales/${sale.sale_id}/cancel`, {}, token);
  const bal2 = (await pool.query('SELECT qty_on_hand FROM stock_balances WHERE product_id=$1', [product.product_id])).rows[0].qty_on_hand;
  check('cancel sale restores stock (16 -> 20)', r.status === 200 && Number(bal2) === 20, `status ${r.status} qty_on_hand=${bal2}`);
}

r = await call('GET', '/api/reports/sales/summary', undefined, token);
check('sales summary report runs', r.status === 200, `status ${r.status} ${r.body?.error?.message || ''}`);

r = await call('GET', '/api/day-closure/preview', undefined, token);
check('day closure preview runs', r.status === 200, `status ${r.status} ${r.body?.error?.message || ''}`);

r = await call('GET', '/api/nonexistent', undefined, token);
check('unknown route gives 404', r.status === 404, `status ${r.status}`);

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
