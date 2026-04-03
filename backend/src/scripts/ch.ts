import { pool } from '../config/database';

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM stock_balances');
    console.log('--- STOCK BALANCES ---');
    console.dir(res.rows, { depth: null });
    
    const qtyIn = await client.query(`
      SELECT product_id, SUM(qty) as sum_qty
      FROM stock_movements
      WHERE reason = 'purchase'
      GROUP BY product_id
    `);
    console.log('--- QTY IN (from stock_movements) ---');
    console.dir(qtyIn.rows, { depth: null });

    const pos = await client.query(`
      SELECT po.po_id, po.status, poi.product_id, poi.qty_received
      FROM purchase_orders po
      JOIN purchase_order_items poi ON po.po_id = poi.po_id
    `);
    console.log('--- PO ITEMS ---');
    console.dir(pos.rows, { depth: null });

  } catch(e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

check();
