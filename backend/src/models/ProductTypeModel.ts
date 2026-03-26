import { BaseModel, PaginatedResult } from './BaseModel';

export interface ProductType {
  id: string;
  name: string;
  display_on_pos: boolean;
  created_at: string;
  updated_at: string;
}

export class ProductTypeModel extends BaseModel {
  static async findAll(): Promise<ProductType[]> {
    const query = `SELECT * FROM product_types ORDER BY name ASC`;
    const result = await this.query<ProductType>(query);
    return result.rows;
  }

  static async findById(id: string): Promise<ProductType | null> {
    const query = `SELECT * FROM product_types WHERE id = $1`;
    const result = await this.query<ProductType>(query, [id]);
    return result.rows[0] || null;
  }

  static async findByName(name: string): Promise<ProductType | null> {
    const query = `SELECT * FROM product_types WHERE name = $1`;
    const result = await this.query<ProductType>(query, [name]);
    return result.rows[0] || null;
  }

  static async create(name: string, display_on_pos: boolean = false): Promise<ProductType> {
    const query = `
      INSERT INTO product_types (name, display_on_pos)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await this.query<ProductType>(query, [name.toUpperCase(), display_on_pos]);
    return result.rows[0];
  }

  static async update(id: string, name: string, display_on_pos: boolean): Promise<ProductType | null> {
    const query = `
      UPDATE product_types
      SET name = $1, display_on_pos = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const result = await this.query<ProductType>(query, [name.toUpperCase(), display_on_pos, id]);
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM product_types WHERE id = $1`;
    const result = await this.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}
