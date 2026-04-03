import { pool } from '../config/database';
import fs from 'fs';

async function dump() {
  const client = await pool.connect();
  try {
    const stores = await client.query('SELECT * FROM stores');
    const sb = await client.query('SELECT * FROM stock_balances');
    const sm = await client.query('SELECT * FROM stock_movements WHERE reason = \'purchase\'');
    const p = await client.query('SELECT product_id, name, track_inventory FROM products');
    const po = await client.query('SELECT * FROM purchase_orders');
    
    fs.writeFileSync('db_dump.json', JSON.stringify({
      stores: stores.rows,
      stock_balances: sb.rows,
      stock_movements: sm.rows,
      products: p.rows,
      purchase_orders: po.rows
    }, null, 2));

  } finally {
    client.release();
    pool.end();
  }
}
dump();
