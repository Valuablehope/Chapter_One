import { BaseModel, PaginatedResult } from './BaseModel';
import { QueryResult } from 'pg';
import { SaleModel } from './SaleModel';

export interface Product {
  product_id: string;
  sku?: string;
  barcode?: string;
  name: string;
  product_type: string;
  list_price?: number;
  sale_price?: number;
  tax_rate?: number;
  track_inventory: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductWithDetails extends Product {
  book_id?: string;
  isbn13?: string;
  subtitle?: string;
  publisher_id?: string;
  publish_year?: number;
  edition?: string;
  language?: string;
  qty_in?: number;      // Sum of qty where reason = 'purchase'
  qty_out?: number;     // Sum of ABS(qty) where reason = 'sale' (qty is negative)
  balance?: number;     // qty_in - qty_out
}

export interface ProductFilters {
  search?: string;
  product_type?: string;
  track_inventory?: boolean;
  page?: number;
  limit?: number;
}

export class ProductModel extends BaseModel {
  static async findAll(filters: ProductFilters = {}): Promise<PaginatedResult<ProductWithDetails>> {
    const { page, limit, offset } = this.getPaginationParams(filters.page, filters.limit);

    // Get default store_id for stock movement aggregation
    const defaultStore = await SaleModel.getDefaultStore();
    const storeId = defaultStore?.store_id || null;

    let query = `
      SELECT 
        p.*,
        pb.book_id,
        pb.isbn13,
        pb.subtitle,
        pb.publisher_id,
        pb.publish_year,
        pb.edition,
        pb.language`;

    // Add stock movement aggregations only if store_id exists
    if (storeId) {
      query += `,
      COALESCE(SUM(CASE WHEN sm.reason = 'purchase' THEN sm.qty ELSE 0 END), 0)::integer as qty_in,
      COALESCE(SUM(CASE WHEN sm.reason = 'sale' THEN ABS(sm.qty) ELSE 0 END), 0)::integer as qty_out,
      (COALESCE(SUM(CASE WHEN sm.reason = 'purchase' THEN sm.qty ELSE 0 END), 0)::integer - 
       COALESCE(SUM(CASE WHEN sm.reason = 'sale' THEN ABS(sm.qty) ELSE 0 END), 0)::integer) as balance`;
    } else {
      query += `,
      0::integer as qty_in,
      0::integer as qty_out,
      0::integer as balance`;
    }

    query += `
      FROM products p
      LEFT JOIN product_books pb ON pb.product_id = p.product_id`;

    // Add stock_movements JOIN only if store_id exists
    if (storeId) {
      query += `
      LEFT JOIN stock_movements sm ON sm.product_id = p.product_id AND sm.store_id = $1`;
    }

    query += `
      WHERE 1=1`;

    const params: any[] = [];
    let paramCount = storeId ? 1 : 0;

    // Add store_id as first parameter if it exists
    if (storeId) {
      params.push(storeId);
    }

    if (filters.search) {
      const searchTerms = filters.search.trim().split(/\s+/).filter(term => term.length > 0);

      if (searchTerms.length > 0) {
        query += ` AND (`;
        const termConditions: string[] = [];

        for (const term of searchTerms) {
          paramCount++;
          // For each term, it must match at least one of the fields
          termConditions.push(`(
            p.name ILIKE $${paramCount} OR
            p.sku ILIKE $${paramCount} OR
            p.barcode ILIKE $${paramCount} OR
            pb.isbn13 ILIKE $${paramCount}
          )`);
          params.push(`%${term}%`);
        }

        // Combine term conditions with AND (all terms must be present)
        query += termConditions.join(' AND ');
        query += `)`;
      }
    }

    if (filters.product_type) {
      paramCount++;
      query += ` AND p.product_type = $${paramCount}`;
      params.push(filters.product_type);
    }

    if (filters.track_inventory !== undefined) {
      paramCount++;
      query += ` AND p.track_inventory = $${paramCount}`;
      params.push(filters.track_inventory);
    }

    // Add GROUP BY clause if we're aggregating stock movements
    if (storeId) {
      query += `
      GROUP BY p.product_id, pb.book_id, pb.isbn13, pb.subtitle, pb.publisher_id, pb.publish_year, pb.edition, pb.language`;
    }

    // Get total count - buildCountQuery will handle the GROUP BY properly by wrapping in subquery
    const countQuery = this.buildCountQuery(query);
    const countResult = await this.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Add pagination
    paramCount++;
    query += ` ORDER BY p.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await this.query<ProductWithDetails>(query, params);
    return this.buildPaginatedResult(result.rows, total, page, limit);
  }

  static async findById(productId: string): Promise<ProductWithDetails | null> {
    const query = `
      SELECT 
        p.*,
        pb.book_id,
        pb.isbn13,
        pb.subtitle,
        pb.publisher_id,
        pb.publish_year,
        pb.edition,
        pb.language
      FROM products p
      LEFT JOIN product_books pb ON pb.product_id = p.product_id
      WHERE p.product_id = $1
    `;
    const result = await this.query<ProductWithDetails>(query, [productId]);
    return result.rows[0] || null;
  }

  static async findByBarcode(barcode: string): Promise<ProductWithDetails | null> {
    const query = `
      SELECT 
        p.*,
        pb.book_id,
        pb.isbn13,
        pb.subtitle,
        pb.publisher_id,
        pb.publish_year,
        pb.edition,
        pb.language
      FROM products p
      LEFT JOIN product_books pb ON pb.product_id = p.product_id
      WHERE p.barcode = $1
    `;
    const result = await this.query<ProductWithDetails>(query, [barcode]);
    return result.rows[0] || null;
  }

  static async findBySku(sku: string): Promise<ProductWithDetails | null> {
    const query = `
      SELECT 
        p.*,
        pb.book_id,
        pb.isbn13,
        pb.subtitle,
        pb.publisher_id,
        pb.publish_year,
        pb.edition,
        pb.language
      FROM products p
      LEFT JOIN product_books pb ON pb.product_id = p.product_id
      WHERE p.sku = $1
    `;
    const result = await this.query<ProductWithDetails>(query, [sku]);
    return result.rows[0] || null;
  }

  static async create(product: Partial<Product>): Promise<Product> {
    const query = `
      INSERT INTO products (
        sku, barcode, name, product_type, list_price, sale_price, 
        tax_rate, track_inventory
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      product.sku || null,
      product.barcode || null,
      product.name,
      product.product_type || 'OTHER',
      product.list_price || 0,
      product.sale_price || null,
      product.tax_rate || null,
      product.track_inventory !== undefined ? product.track_inventory : true,
    ];
    const result = await this.query<Product>(query, values);
    return result.rows[0];
  }

  static async update(productId: string, updates: Partial<Product>): Promise<Product> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (updates.sku !== undefined) {
      paramCount++;
      fields.push(`sku = $${paramCount}`);
      values.push(updates.sku);
    }
    if (updates.barcode !== undefined) {
      paramCount++;
      fields.push(`barcode = $${paramCount}`);
      values.push(updates.barcode);
    }
    if (updates.name !== undefined) {
      paramCount++;
      fields.push(`name = $${paramCount}`);
      values.push(updates.name);
    }
    if (updates.product_type !== undefined) {
      paramCount++;
      fields.push(`product_type = $${paramCount}`);
      values.push(updates.product_type);
    }
    if (updates.list_price !== undefined) {
      paramCount++;
      fields.push(`list_price = $${paramCount}`);
      values.push(updates.list_price);
    }
    if (updates.sale_price !== undefined) {
      paramCount++;
      fields.push(`sale_price = $${paramCount}`);
      values.push(updates.sale_price);
    }
    if (updates.tax_rate !== undefined) {
      paramCount++;
      fields.push(`tax_rate = $${paramCount}`);
      values.push(updates.tax_rate);
    }
    if (updates.track_inventory !== undefined) {
      paramCount++;
      fields.push(`track_inventory = $${paramCount}`);
      values.push(updates.track_inventory);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // Add updated_at without incrementing paramCount since NOW() doesn't use a parameter
    fields.push(`updated_at = NOW()`);

    paramCount++;
    values.push(productId);

    const query = `
      UPDATE products
      SET ${fields.join(', ')}
      WHERE product_id = $${paramCount}
      RETURNING *
    `;
    const result = await this.query<Product>(query, values);
    return result.rows[0];
  }

  // Check if product has any transactions (sales or purchase orders)
  static async hasTransactions(productId: string): Promise<boolean> {
    // Check for sales
    const salesQuery = `
      SELECT COUNT(*) FROM sale_items 
      WHERE product_id = $1
    `;
    const salesResult = await this.query(salesQuery, [productId]);
    const salesCount = parseInt(salesResult.rows[0].count, 10);

    // Check for purchase orders
    const poQuery = `
      SELECT COUNT(*) FROM purchase_order_items 
      WHERE product_id = $1
    `;
    const poResult = await this.query(poQuery, [productId]);
    const poCount = parseInt(poResult.rows[0].count, 10);

    return salesCount > 0 || poCount > 0;
  }

  static async delete(productId: string): Promise<boolean> {
    // Check if product has transactions
    const hasTrans = await this.hasTransactions(productId);
    if (hasTrans) {
      throw new Error('Cannot delete product that has existing transactions (sales or purchase orders)');
    }

    const query = 'DELETE FROM products WHERE product_id = $1';
    const result = await this.query(query, [productId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async checkBarcodeUnique(barcode: string, excludeProductId?: string): Promise<boolean> {
    let query = 'SELECT COUNT(*) FROM products WHERE barcode = $1';
    const params: any[] = [barcode];

    if (excludeProductId) {
      query += ' AND product_id != $2';
      params.push(excludeProductId);
    }

    const result = await this.query(query, params);
    return parseInt(result.rows[0].count, 10) === 0;
  }
}




