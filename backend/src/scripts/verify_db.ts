import { pool } from '../config/database';

async function verify() {
  const client = await pool.connect();
  try {
    const receivedCount = await client.query(`SELECT COUNT(*) FROM purchase_orders WHERE status = 'RECEIVED'`);
    console.log(`RECEIVED POs:`, receivedCount.rows[0].count);

    const smCount = await client.query(`SELECT COUNT(*) FROM stock_movements WHERE reason = 'purchase'`);
    console.log(`Purchase Stock Movements:`, smCount.rows[0].count);

    const productsWithPO = await client.query(`
      SELECT 
        p.name, 
        p.track_inventory,
        SUM(poi.qty_ordered) as total_ordered,
        SUM(poi.qty_received) as total_received,
        (SELECT SUM(qty) FROM stock_movements sm WHERE sm.product_id = p.product_id AND sm.reason = 'purchase') as sm_qty_in
      FROM products p
      JOIN purchase_order_items poi ON p.product_id = poi.product_id
      JOIN purchase_orders po ON po.po_id = poi.po_id
      WHERE po.status = 'RECEIVED' AND p.track_inventory = true
      GROUP BY p.product_id, p.name, p.track_inventory
    `);

    console.log(`\nProducts with Received POs (track_inventory = true):`);
    console.table(productsWithPO.rows.map(r => ({
      name: r.name.substring(0, 30),
      total_ordered: r.total_ordered,
      total_received: r.total_received,
      sm_qty_in: r.sm_qty_in
    })));

  } finally {
    client.release();
    pool.end();
  }
}
verify();
