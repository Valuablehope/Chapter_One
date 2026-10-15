import { BaseModel } from './BaseModel';

export interface StockMovement {
  movement_id: string;
  store_id: string;
  product_id: string;
  reason: string;
  qty: number;
  reference?: string;
  created_by?: string;
  created_at: string;
}

export interface StockBalance {
  store_id: string;
  product_id: string;
  qty_on_hand: number;
}

export class StockModel extends BaseModel {
  static async getStockBalance(
    storeId: string,
    productId: string
  ): Promise<StockBalance | null> {
    const query = `
      SELECT store_id, product_id, qty_on_hand
      FROM stock_balances
      WHERE store_id = $1 AND product_id = $2
    `;
    const result = await this.query<StockBalance>(query, [storeId, productId]);
    return result.rows[0] || null;
  }

  static async getStockBalancesByStore(storeId: string): Promise<StockBalance[]> {
    const query = `
      SELECT store_id, product_id, qty_on_hand
      FROM stock_balances
      WHERE store_id = $1
      ORDER BY product_id
    `;
    const result = await this.query<StockBalance>(query, [storeId]);
    return result.rows;
  }

  static async createMovement(movement: Partial<StockMovement>): Promise<StockMovement> {
    const query = `
      INSERT INTO stock_movements (
        store_id, product_id, reason, qty, reference, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      movement.store_id,
      movement.product_id,
      movement.reason,
      movement.qty,
      movement.reference || null,
      movement.created_by || null,
    ];
    const result = await this.query<StockMovement>(query, values);
    return result.rows[0];
  }

  static async getMovementsByProduct(
    storeId: string,
    productId: string,
    limit: number = 50
  ): Promise<StockMovement[]> {
    const query = `
      SELECT *
      FROM stock_movements
      WHERE store_id = $1 AND product_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;
    const result = await this.query<StockMovement>(query, [storeId, productId, limit]);
    return result.rows;
  }
}











