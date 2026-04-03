import { pool } from '../config/database';
import { logger } from './logger';

export async function fixStockBalancesOnStartup() {
  const client = await pool.connect();
  let fixedCount = 0;

  try {
    await client.query('BEGIN');

    // 1. Get all RECEIVED purchase orders and their items
    const poItemsResult = await client.query(`
      SELECT 
        po.po_id,
        po.po_number,
        po.store_id,
        poi.po_item_id,
        poi.product_id,
        poi.qty_received,
        poi.qty_ordered,
        p.track_inventory
      FROM purchase_orders po
      JOIN purchase_order_items poi ON poi.po_id = po.po_id
      JOIN products p ON p.product_id = poi.product_id
      WHERE po.status = 'RECEIVED' AND p.track_inventory = true
    `);

    const receivedItems = poItemsResult.rows;

    for (const item of receivedItems) {
      const { store_id, product_id, po_number } = item;
      const qty = Number(item.qty_received) > 0 ? Number(item.qty_received) : Number(item.qty_ordered);

      // Check if a stock movement already exists for this PO and product
      const movementResult = await client.query(`
        SELECT movement_id 
        FROM stock_movements 
        WHERE store_id = $1 
          AND product_id = $2 
          AND reason = 'purchase' 
          AND reference = $3
      `, [store_id, product_id, po_number]);

      if (movementResult.rows.length === 0) {
        logger.info(`Auto-fixing missing stock movement for PO ${po_number}, Product ${product_id}`);

        // Insert missing stock movement
        await client.query(`
          INSERT INTO stock_movements (
            store_id, product_id, reason, qty, reference, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          store_id,
          product_id,
          'purchase',
          qty,
          po_number,
          null
        ]);

        // Update stock balance atomically
        await client.query(`
          INSERT INTO stock_balances (store_id, product_id, qty_on_hand)
          VALUES ($1, $2, $3)
          ON CONFLICT (store_id, product_id)
          DO UPDATE SET 
            qty_on_hand = stock_balances.qty_on_hand + $3,
            updated_at = NOW()
        `, [store_id, product_id, qty]);

        fixedCount++;
      }
    }

    await client.query('COMMIT');
    if (fixedCount > 0) {
      logger.info(`✅ Successfully auto-fixed ${fixedCount} missing stock movements/balances on startup.`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to auto-fix stock balances on startup', { error });
  } finally {
    client.release();
  }
}
