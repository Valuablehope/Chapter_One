import { BaseModel, PaginatedResult } from './BaseModel';
import { pool } from '../config/database';

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

  // Generate PO number
  static async generatePONumber(storeId: string): Promise<string> {
    const query = `
      SELECT COUNT(*) as count
      FROM purchase_orders
      WHERE store_id = $1 AND DATE(ordered_at) = CURRENT_DATE
    `;
    const result = await this.query(query, [storeId]);
    const count = parseInt(result.rows[0].count, 10);
    
    // Format: PO-YYYYMMDD-XXXX (e.g., PO-20231205-0001)
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const sequence = String(count + 1).padStart(4, '0');
    return `PO-${date}-${sequence}`;
  }

  // Create purchase order
  static async create(data: CreatePurchaseOrderData): Promise<PurchaseOrderWithDetails> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get store
      const store = await this.getDefaultStore();
      if (!store) {
        throw new Error('No active store found');
      }

      // Generate PO number
      const poNumber = await this.generatePONumber(store.store_id);

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
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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

    const result = await this.query(query, params);
    const purchaseOrders = result.rows;

    // If no purchase orders, return empty result
    if (purchaseOrders.length === 0) {
      return this.buildPaginatedResult([], total, page, limit);
    }

    // Get all items for all purchase orders in a single query (fixes N+1 problem)
    const poIds = purchaseOrders.map(po => po.po_id);
    const itemsQuery = `
      SELECT poi.*, p.name as product_name, p.barcode
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
    const purchaseOrdersWithDetails: PurchaseOrderWithDetails[] = purchaseOrders.map(po => {
      const items = itemsByPoId.get(po.po_id) || [];
      const totalCost = items.reduce((sum, item) => {
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
    const result = await this.query(query, [poId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const po = result.rows[0];

    // Get items
    const itemsQuery = `
      SELECT poi.*, p.name as product_name, p.barcode
      FROM purchase_order_items poi
      LEFT JOIN products p ON p.product_id = poi.product_id
      WHERE poi.po_id = $1
    `;
    const itemsResult = await this.query(itemsQuery, [poId]);
    const items = itemsResult.rows;

    const totalCost = items.reduce((sum, item) => {
      return sum + (item.qty_ordered * item.unit_cost);
    }, 0);

    return {
      ...po,
      items,
      supplier: po.supplier_name ? {
        supplier_id: po.supplier_id,
        name: po.supplier_name,
        contact_person: po.supplier_contact,
        phone: po.supplier_phone,
      } : undefined,
      total_cost: totalCost,
    };
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

  // Receive purchase order (update stock)
  static async receivePurchaseOrder(poId: string): Promise<PurchaseOrderWithDetails> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get purchase order with items
      const po = await this.findById(poId);
      if (!po) {
        throw new Error('Purchase order not found');
      }

      if (po.status === 'RECEIVED') {
        throw new Error('Purchase order already received');
      }

      // Update stock for each item
      for (const item of po.items) {
        const qtyReceived = item.qty_received || item.qty_ordered;
        
        // Check if product tracks inventory
        const productQuery = `
          SELECT track_inventory FROM products WHERE product_id = $1
        `;
        const productResult = await client.query(productQuery, [item.product_id]);
        
        if (productResult.rows[0]?.track_inventory) {
          // Create stock movement (inbound)
          const stockQuery = `
            INSERT INTO stock_movements (
              store_id, product_id, reason, qty, reference, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `;
          await client.query(stockQuery, [
            po.store_id,
            item.product_id,
            'purchase',
            qtyReceived,
            po.po_number,
            null, // System created
          ]);
        }

        // Update qty_received
        const updateItemQuery = `
          UPDATE purchase_order_items
          SET qty_received = $1
          WHERE po_item_id = $2
        `;
        await client.query(updateItemQuery, [qtyReceived, item.po_item_id]);
      }

      // Update purchase order status
      const updateQuery = `
        UPDATE purchase_orders
        SET status = 'RECEIVED', received_at = NOW()
        WHERE po_id = $1
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [poId]);
      const updatedPO = updateResult.rows[0];

      await client.query('COMMIT');

      // Return updated purchase order
      return await this.findById(poId) as PurchaseOrderWithDetails;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete purchase order
  static async delete(poId: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete items first
      await client.query('DELETE FROM purchase_order_items WHERE po_id = $1', [poId]);
      
      // Delete purchase order
      await client.query('DELETE FROM purchase_orders WHERE po_id = $1', [poId]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

