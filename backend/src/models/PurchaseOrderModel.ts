import { BaseModel, PaginatedResult } from './BaseModel';
import { pool } from '../config/database';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';

export type PurchaseOrderStatus = 'OPEN' | 'PENDING' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrder {
  po_id: string;
  supplier_id: string;
  store_id: string;
  po_number: string;
  status: PurchaseOrderStatus;
  ordered_at: string;
  expected_at?: string;
  received_at?: string;
}

export interface PurchaseOrderItem {
  po_item_id: string;
  po_id: string;
  product_id: string;
  product_name?: string;
  barcode?: string;
  unit_of_measure?: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
}

export interface CreatePurchaseOrderData {
  supplier_id: string;
  expected_at?: string;
  items: {
    product_id: string;
    qty_ordered: number;
    unit_cost: number;
  }[];
}

export interface UpdatePurchaseOrderData {
  supplier_id?: string;
  expected_at?: string;
  items?: {
    product_id: string;
    qty_ordered: number;
    unit_cost: number;
  }[];
}

export interface PurchaseOrderWithDetails extends PurchaseOrder {
  items: PurchaseOrderItem[];
  supplier?: {
    supplier_id: string;
    name: string;
    contact_name?: string;
    phone?: string;
  };
  total_cost: number;
}

// Type for SQL query result that includes supplier fields from JOIN
interface PurchaseOrderWithSupplierFields extends PurchaseOrder {
  supplier_name?: string;
  supplier_contact?: string;
  supplier_phone?: string;
}

export interface PurchaseOrderFilters {
  supplier_id?: string;
  status?: PurchaseOrderStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export class PurchaseOrderModel extends BaseModel {
  // Get default store (first active store)
  static async getDefaultStore(): Promise<{ store_id: string; code: string; name: string } | null> {
    const query = `
      SELECT store_id, code, name
      FROM stores
      WHERE is_active = true
      ORDER BY created_at ASC
      LIMIT 1
    `;
    const result = await this.query(query);
    return result.rows[0] || null;
  }

  // Generate PO number — runs inside transaction for safety
  static async generatePONumber(client: any, storeId: string): Promise<string> {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');

    // Count existing POs for today to get starting sequence
    const result = await client.query(
      `SELECT COUNT(*) as count FROM purchase_orders
       WHERE store_id = $1 AND DATE(ordered_at) = CURRENT_DATE`,
      [storeId]
    );
    let sequence = parseInt(result.rows[0].count, 10) + 1;

    // Loop until we find a sequence that doesn't already exist
    // (handles rapid concurrent creation)
    while (true) {
      const candidate = `PO-${date}-${String(sequence).padStart(4, '0')}`;
      const exists = await client.query(
        'SELECT 1 FROM purchase_orders WHERE po_number = $1',
        [candidate]
      );
      if (exists.rows.length === 0) {
        return candidate;
      }
      sequence++;
    }
  }

  // Synchronize product prices based on PO unit cost
  private static async syncProductPrice(client: any, productId: string, unitCost: number): Promise<void> {
    const productRes = await client.query(
      'SELECT list_price, sale_price, margin_pct FROM products WHERE product_id = $1',
      [productId]
    );
    const product = productRes.rows[0];
    if (!product) return;

    if (Number(product.list_price) !== Number(unitCost)) {
      const newListPrice = Number(unitCost);
      const marginPct = product.margin_pct !== null ? Number(product.margin_pct) : null;
      let newSalePrice = product.sale_price !== null ? Number(product.sale_price) : null;

      if (marginPct !== null) {
        newSalePrice = newListPrice * (1 + marginPct / 100);
        newSalePrice = Math.round(newSalePrice * 100) / 100;
      }

      await client.query(
        'UPDATE products SET list_price = $1, sale_price = $2, updated_at = NOW() WHERE product_id = $3',
        [newListPrice, newSalePrice, productId]
      );
    }
  }

  // Create purchase order
  static async create(data: CreatePurchaseOrderData): Promise<PurchaseOrderWithDetails> {
    return await withRetry(
      async () => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      // Set transaction timeout (30 seconds) to prevent long-running transactions
      await client.query('SET LOCAL statement_timeout = 30000');

      // Get store
      const store = await this.getDefaultStore();
      if (!store) {
        throw new Error('No active store found');
      }

      // Generate PO number inside transaction to avoid race conditions
      const poNumber = await this.generatePONumber(client, store.store_id);

      // Create purchase order
      const poQuery = `
        INSERT INTO purchase_orders (
          supplier_id, store_id, po_number, status, expected_at
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const poValues = [
        data.supplier_id,
        store.store_id,
        poNumber,
        'OPEN',
        data.expected_at || null,
      ];
      const poResult = await client.query(poQuery, poValues);
      const purchaseOrder = poResult.rows[0];

      // Create purchase order items
      const items: PurchaseOrderItem[] = [];
      let totalCost = 0;

      for (const item of data.items) {
        if (item.qty_ordered <= 0) {
          throw new Error('Item quantity must be greater than 0');
        }
        if (item.unit_cost < 0) {
          throw new Error('Item unit cost cannot be negative');
        }

        const itemQuery = `
          INSERT INTO purchase_order_items (
            po_id, product_id, qty_ordered, qty_received, unit_cost
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        const itemValues = [
          purchaseOrder.po_id,
          item.product_id,
          item.qty_ordered,
          0, // qty_received starts at 0
          item.unit_cost,
        ];
        const itemResult = await client.query(itemQuery, itemValues);
        items.push(itemResult.rows[0]);
        totalCost += item.qty_ordered * item.unit_cost;

        // Sync product prices based on unit cost
        await this.syncProductPrice(client, item.product_id, item.unit_cost);
      }

      await client.query('COMMIT');

      // Get supplier details
      const supplierQuery = `
        SELECT supplier_id, name, contact_name, phone
        FROM suppliers
        WHERE supplier_id = $1
      `;
      const supplierResult = await client.query(supplierQuery, [data.supplier_id]);
      const supplier = supplierResult.rows[0] || null;

      return {
        ...purchaseOrder,
        items,
        supplier: supplier ? {
          supplier_id: supplier.supplier_id,
          name: supplier.name,
          contact_name: supplier.contact_name,
          phone: supplier.phone,
        } : undefined,
        total_cost: totalCost,
      };
    } catch (error) {
      // Always rollback on error
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Log rollback error but don't mask original error
        console.error('Failed to rollback transaction:', rollbackError);
      }
      throw error;
    } finally {
      // Always release client, even if rollback failed
      try {
        client.release();
      } catch (releaseError) {
        // Log release error - this is critical
        console.error('Failed to release database client:', releaseError);
      }
    }
      },
      {
        maxAttempts: 3,
        backoffMs: 150,
        onRetry: (attempt, error) => {
          logger.warn(`Retrying purchase order create (attempt ${attempt})`, {
            error: error.message,
            code: (error as any).code,
          });
        },
      }
    );
  }

  // Get all purchase orders with filters
  static async findAll(filters: PurchaseOrderFilters = {}): Promise<PaginatedResult<PurchaseOrderWithDetails>> {
    const { page, limit, offset } = this.getPaginationParams(filters.page, filters.limit);
    
    let query = `
      SELECT 
        po.*,
        s.name as supplier_name,
        s.contact_name as supplier_contact,
        s.phone as supplier_phone
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.supplier_id = po.supplier_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (filters.supplier_id) {
      paramCount++;
      query += ` AND po.supplier_id = $${paramCount}`;
      params.push(filters.supplier_id);
    }

    if (filters.status) {
      paramCount++;
      query += ` AND po.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.search) {
      paramCount++;
      query += ` AND (
        po.po_number ILIKE $${paramCount} OR
        s.name ILIKE $${paramCount}
      )`;
      params.push(`%${filters.search}%`);
    }

    // Get total count
    const countQuery = this.buildCountQuery(query);
    const countResult = await this.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Add pagination
    paramCount++;
    query += ` ORDER BY po.ordered_at DESC LIMIT $${paramCount}`;
    params.push(limit);
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await this.query<PurchaseOrderWithSupplierFields>(query, params);
    const purchaseOrders = result.rows;

    // If no purchase orders, return empty result
    if (purchaseOrders.length === 0) {
      return this.buildPaginatedResult([], total, page, limit);
    }

    // Get all items for all purchase orders in a single query (fixes N+1 problem)
    const poIds = purchaseOrders.map((po: PurchaseOrderWithSupplierFields) => po.po_id);
    const itemsQuery = `
      SELECT poi.*, p.name as product_name, p.barcode, p.unit_of_measure
      FROM purchase_order_items poi
      LEFT JOIN products p ON p.product_id = poi.product_id
      WHERE poi.po_id = ANY($1)
      ORDER BY poi.po_id
    `;
    const itemsResult = await this.query(itemsQuery, [poIds]);
    const allItems = itemsResult.rows;

    // Group items by po_id
    const itemsByPoId = new Map<string, typeof allItems>();
    for (const item of allItems) {
      if (!itemsByPoId.has(item.po_id)) {
        itemsByPoId.set(item.po_id, []);
      }
      itemsByPoId.get(item.po_id)!.push(item);
    }

    // Build purchase orders with details
    const purchaseOrdersWithDetails: PurchaseOrderWithDetails[] = purchaseOrders.map((po: PurchaseOrderWithSupplierFields) => {
      const items = itemsByPoId.get(po.po_id) || [];
      const totalCost = items.reduce((sum: number, item: PurchaseOrderItem & { product_name?: string; barcode?: string }) => {
        return sum + (item.qty_ordered * item.unit_cost);
      }, 0);

      return {
        ...po,
        items,
        supplier: po.supplier_name ? {
          supplier_id: po.supplier_id,
          name: po.supplier_name,
          contact_name: po.supplier_contact,
          phone: po.supplier_phone,
        } : undefined,
        total_cost: totalCost,
      };
    });

    return this.buildPaginatedResult(purchaseOrdersWithDetails, total, page, limit);
  }

  // Get purchase order by ID
  static async findById(poId: string): Promise<PurchaseOrderWithDetails | null> {
    const query = `
      SELECT 
        po.*,
        s.name as supplier_name,
        s.contact_name as supplier_contact,
        s.phone as supplier_phone
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.supplier_id = po.supplier_id
      WHERE po.po_id = $1
    `;
    const result = await this.query<PurchaseOrderWithSupplierFields>(query, [poId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const po = result.rows[0];

    // Get items
    const itemsQuery = `
      SELECT poi.*, p.name as product_name, p.barcode, p.unit_of_measure
      FROM purchase_order_items poi
      LEFT JOIN products p ON p.product_id = poi.product_id
      WHERE poi.po_id = $1
    `;
    const itemsResult = await this.query<PurchaseOrderItem & { product_name?: string; barcode?: string; unit_of_measure?: string }>(itemsQuery, [poId]);
    const items = itemsResult.rows;

    const totalCost = items.reduce((sum: number, item: PurchaseOrderItem & { product_name?: string; barcode?: string }) => {
      return sum + (item.qty_ordered * item.unit_cost);
    }, 0);

    return {
      ...po,
      items,
      supplier: po.supplier_name ? {
        supplier_id: po.supplier_id,
        name: po.supplier_name,
        contact_name: po.supplier_contact,
        phone: po.supplier_phone,
      } : undefined,
      total_cost: totalCost,
    };
  }

  // Update purchase order
  static async update(poId: string, data: UpdatePurchaseOrderData): Promise<PurchaseOrderWithDetails> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL statement_timeout = 30000');
      await client.query('SET LOCAL lock_timeout = 5000');
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

      // Check if PO exists and can be edited (only OPEN status can be edited)
      const existingPO = await this.findById(poId);
      if (!existingPO) {
        throw new Error('Purchase order not found');
      }
      
      if (existingPO.status !== 'OPEN') {
        throw new Error('Only OPEN purchase orders can be edited');
      }

      // Update supplier if provided
      if (data.supplier_id) {
        await client.query(
          'UPDATE purchase_orders SET supplier_id = $1 WHERE po_id = $2',
          [data.supplier_id, poId]
        );
      }

      // Update expected_at if provided
      if (data.expected_at !== undefined) {
        await client.query(
          'UPDATE purchase_orders SET expected_at = $1 WHERE po_id = $2',
          [data.expected_at || null, poId]
        );
      }

      // Update items if provided
      if (data.items && data.items.length > 0) {
        // Delete existing items
        await client.query('DELETE FROM purchase_order_items WHERE po_id = $1', [poId]);
        
        // Insert new items
        for (const item of data.items) {
          await client.query(
            `INSERT INTO purchase_order_items (po_id, product_id, qty_ordered, qty_received, unit_cost)
             VALUES ($1, $2, $3, 0, $4)`,
            [poId, item.product_id, item.qty_ordered, item.unit_cost]
          );

          // Sync product prices based on unit cost
          await this.syncProductPrice(client, item.product_id, item.unit_cost);
        }
      }

      await client.query('COMMIT');
      
      // Return updated purchase order
      const updatedPO = await this.findById(poId);
      if (!updatedPO) {
        throw new Error('Failed to retrieve updated purchase order');
      }
      
      return updatedPO;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Update purchase order status
  static async updateStatus(
    poId: string,
    status: PurchaseOrderStatus,
    receivedAt?: string
  ): Promise<PurchaseOrder> {
    const query = `
      UPDATE purchase_orders
      SET status = $1, received_at = $2
      WHERE po_id = $3
      RETURNING *
    `;
    const result = await this.query(query, [status, receivedAt || null, poId]);
    return result.rows[0];
  }

  // Receive purchase order (update stock) with REPEATABLE READ isolation and row-level locking
  // REPEATABLE READ is more performant than SERIALIZABLE while still preventing race conditions
  // with proper row-level locking (FOR UPDATE)
  static async receivePurchaseOrder(poId: string): Promise<PurchaseOrderWithDetails> {
    return await withRetry(
      async () => {
        const client = await pool.connect();
        
        try {
          await client.query('BEGIN');
          // Set transaction timeout (30 seconds) to prevent long-running transactions
          await client.query('SET LOCAL statement_timeout = 30000');
          // Set lock timeout (5 seconds) to prevent indefinite blocking
          await client.query('SET LOCAL lock_timeout = 5000');
          // Set REPEATABLE READ isolation level (more performant than SERIALIZABLE)
          // Row-level locking (FOR UPDATE) provides sufficient protection against race conditions
          await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

          // Get purchase order INSIDE the transaction using the locked client
          const poResult = await client.query(`
            SELECT 
              po.*,
              s.name as supplier_name,
              s.contact_name as supplier_contact,
              s.phone as supplier_phone
            FROM purchase_orders po
            LEFT JOIN suppliers s ON s.supplier_id = po.supplier_id
            WHERE po.po_id = $1
            FOR UPDATE OF po
          `, [poId]);

          if (poResult.rows.length === 0) {
            throw new Error('Purchase order not found');
          }

          const poRow = poResult.rows[0];

          if (poRow.status === 'RECEIVED') {
            throw new Error('Purchase order already received');
          }

          // Get items for this PO inside the transaction
          const itemsResult = await client.query(`
            SELECT poi.*, p.name as product_name, p.barcode, p.unit_of_measure, p.track_inventory
            FROM purchase_order_items poi
            LEFT JOIN products p ON p.product_id = poi.product_id
            WHERE poi.po_id = $1
          `, [poId]);

          const items = itemsResult.rows;

          // Update stock for each item
          for (const item of items) {
            const qtyReceived = Number(item.qty_received) > 0 ? Number(item.qty_received) : Number(item.qty_ordered);
            
            if (item.track_inventory) {
              // Lock stock balance row for update (prevents concurrent modifications)
              await client.query(`
                SELECT qty_on_hand FROM stock_balances
                WHERE store_id = $1 AND product_id = $2
                FOR UPDATE
              `, [poRow.store_id, item.product_id]);
              
              // Create stock movement (inbound)
              await client.query(`
                INSERT INTO stock_movements (
                  store_id, product_id, reason, qty, reference, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6)
              `, [
                poRow.store_id,
                item.product_id,
                'purchase',
                qtyReceived,
                poRow.po_number,
                null, // System created
              ]);
              
              // Update stock balance atomically (maintain O(1) query performance)
              await client.query(`
                INSERT INTO stock_balances (store_id, product_id, qty_on_hand)
                VALUES ($1, $2, $3)
                ON CONFLICT (store_id, product_id)
                DO UPDATE SET 
                  qty_on_hand = stock_balances.qty_on_hand + $3,
                  updated_at = NOW()
              `, [poRow.store_id, item.product_id, qtyReceived]);
            }

            // Update qty_received on the purchase order item
            await client.query(`
              UPDATE purchase_order_items
              SET qty_received = $1
              WHERE po_item_id = $2
            `, [qtyReceived, item.po_item_id]);
          }

          // Update purchase order status to RECEIVED
          await client.query(`
            UPDATE purchase_orders
            SET status = 'RECEIVED', received_at = NOW()
            WHERE po_id = $1
          `, [poId]);

          await client.query('COMMIT');

          // Return updated purchase order (after commit, safe to use pool)
          return await this.findById(poId) as PurchaseOrderWithDetails;
        } catch (error) {
          // Always rollback on error
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            // Log rollback error but don't mask original error
            console.error('Failed to rollback transaction:', rollbackError);
          }
          throw error;
        } finally {
          // Always release client, even if rollback failed
          try {
            client.release();
          } catch (releaseError) {
            // Log release error - this is critical
            console.error('Failed to release database client:', releaseError);
          }
        }
      },
      {
        maxAttempts: 3,
        backoffMs: 100,
        onRetry: (attempt, error) => {
          logger.warn(`Retrying purchase order receive (attempt ${attempt})`, {
            error: error.message,
            code: (error as any).code,
            poId,
          });
        },
      }
    );
  }

  // Delete purchase order
  static async delete(poId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      // Set transaction timeout (30 seconds) to prevent long-running transactions
      await client.query('SET LOCAL statement_timeout = 30000');

      // Fetch PO header so we know its status, store, and reference number
      const poResult = await client.query(
        'SELECT po_id, store_id, po_number, status FROM purchase_orders WHERE po_id = $1',
        [poId]
      );
      if (poResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('Purchase order not found');
      }
      const { store_id, po_number, status } = poResult.rows[0];

      // If the PO was already received, its items were added to stock — reverse that now
      if (status === 'RECEIVED') {
        const itemsResult = await client.query(
          `SELECT poi.product_id, poi.qty_received, poi.qty_ordered, p.track_inventory
           FROM purchase_order_items poi
           LEFT JOIN products p ON p.product_id = poi.product_id
           WHERE poi.po_id = $1`,
          [poId]
        );
        for (const item of itemsResult.rows) {
          if (item.track_inventory) {
            const qtyReceived = Number(item.qty_received) > 0 ? Number(item.qty_received) : Number(item.qty_ordered);
            // Subtract the previously added qty from stock
            await client.query(`
              INSERT INTO stock_balances (store_id, product_id, qty_on_hand)
              VALUES ($1, $2, 0)
              ON CONFLICT (store_id, product_id)
              DO UPDATE SET
                qty_on_hand = stock_balances.qty_on_hand - $3,
                updated_at = NOW()
            `, [store_id, item.product_id, qtyReceived]);
          }
        }
        // Remove stock_movements tied to this purchase order
        await client.query(
          `DELETE FROM stock_movements WHERE store_id = $1 AND reference = $2 AND reason = 'purchase'`,
          [store_id, po_number]
        );
      }

      // Delete items first
      await client.query('DELETE FROM purchase_order_items WHERE po_id = $1', [poId]);

      // Delete purchase order
      await client.query('DELETE FROM purchase_orders WHERE po_id = $1', [poId]);

      await client.query('COMMIT');
    } catch (error) {
      // Always rollback on error
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Log rollback error but don't mask original error
        console.error('Failed to rollback transaction:', rollbackError);
      }
      throw error;
    } finally {
      // Always release client, even if rollback failed
      try {
        client.release();
      } catch (releaseError) {
        // Log release error - this is critical
        console.error('Failed to release database client:', releaseError);
      }
    }
  }
}

