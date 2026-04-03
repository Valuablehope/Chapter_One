import { pool } from '../config/database';
import { PurchaseOrderModel } from './PurchaseOrderModel';

async function testReceive() {
  try {
    const po = await pool.query("SELECT po_id FROM purchase_orders WHERE status = 'OPEN' LIMIT 1");
    if (po.rows.length > 0) {
      console.log('Receiving PO', po.rows[0].po_id);
      await PurchaseOrderModel.receivePurchaseOrder(po.rows[0].po_id);
      console.log('Done receiving PO');
    } else {
      console.log('No OPEN PO exists to receive');
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    pool.end();
  }
}
testReceive();
