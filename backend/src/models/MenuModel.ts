import { BaseModel } from './BaseModel';

export type MenuType = 'regular' | 'holiday' | 'seasonal' | 'event' | 'special';

export interface MenuItemRow {
  name: string;
  price: number;
  description?: string;
  product_id?: string;
}

export interface MenuCategoryRow {
  name: string;
  items: MenuItemRow[];
}

export interface Menu {
  menu_id: string;
  store_id: string;
  name: string;
  description: string | null;
  menu_type: MenuType;
  is_active: boolean;
  display_order: number;
  categories: MenuCategoryRow[];
  created_at: string;
  updated_at: string;
}

export interface MenuInput {
  name: string;
  description?: string | null;
  menu_type?: MenuType;
  is_active?: boolean;
  display_order?: number;
  categories?: MenuCategoryRow[];
}

export interface MenuFilters {
  search?: string;
  is_active?: boolean;
  menu_type?: MenuType;
  page?: number;
  limit?: number;
}

interface RawMenu {
  menu_id: string;
  store_id: string;
  name: string;
  description: string | null;
  menu_type: MenuType;
  is_active: boolean;
  display_order: number;
  categories: unknown;
  created_at: string;
  updated_at: string;
}

function parseCategories(raw: unknown): MenuCategoryRow[] {
  if (Array.isArray(raw)) return raw as MenuCategoryRow[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as MenuCategoryRow[]; } catch { return []; }
  }
  return [];
}

function normalise(row: RawMenu): Menu {
  return { ...row, categories: parseCategories(row.categories) };
}

export class MenuModel extends BaseModel {

  static async findAll(
    storeId: string,
    filters: MenuFilters = {}
  ): Promise<{ data: Menu[]; total: number }> {
    const { search, is_active, menu_type, page = 1, limit = 50 } = filters;
    const conditions: string[] = ['store_id = $1'];
    const values: unknown[] = [storeId];
    let p = 1;

    if (search) {
      p++;
      conditions.push(`name ILIKE $${p}`);
      values.push(`%${search}%`);
    }
    if (is_active !== undefined) {
      p++;
      conditions.push(`is_active = $${p}`);
      values.push(is_active);
    }
    if (menu_type) {
      p++;
      conditions.push(`menu_type = $${p}`);
      values.push(menu_type);
    }

    const where = conditions.join(' AND ');

    const countResult = await this.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM restaurant_menus WHERE ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const offset = (page - 1) * limit;
    p++; values.push(limit);
    const limitParam = p;
    p++; values.push(offset);
    const offsetParam = p;

    const result = await this.query<RawMenu>(
      `SELECT * FROM restaurant_menus
       WHERE ${where}
       ORDER BY display_order ASC, created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      values
    );

    return { data: result.rows.map(normalise), total };
  }

  static async findById(menuId: string): Promise<Menu | null> {
    const result = await this.query<RawMenu>(
      'SELECT * FROM restaurant_menus WHERE menu_id = $1',
      [menuId]
    );
    const row = result.rows[0];
    return row ? normalise(row) : null;
  }

  private static async syncProducts(categories: MenuCategoryRow[]): Promise<MenuCategoryRow[]> {
    if (!categories || !Array.isArray(categories)) return categories;
    for (const cat of categories) {
      if (!cat.items || !Array.isArray(cat.items)) continue;
      for (const item of cat.items) {
        if (!item.name) continue;
        const name = item.name.trim();

        const res = await this.query<{ product_id: string }>(
          'SELECT product_id FROM products WHERE LOWER(name) = LOWER($1) LIMIT 1',
          [name]
        );

        let productId = res.rows[0]?.product_id;

        if (!productId) {
          const insertRes = await this.query<{ product_id: string }>(
            `INSERT INTO products (name, sale_price, product_type, track_inventory)
             VALUES ($1, $2, 'OTHER', false)
             RETURNING product_id`,
            [name, item.price || 0]
          );
          productId = insertRes.rows[0].product_id;
        }

        item.product_id = productId;
      }
    }
    return categories;
  }

  static async create(storeId: string, input: MenuInput): Promise<Menu> {
    const {
      name,
      description = null,
      menu_type = 'regular',
      is_active = true,
      display_order = 0,
      categories = [],
    } = input;

    const syncedCategories = await this.syncProducts(categories);

    const result = await this.query<RawMenu>(
      `INSERT INTO restaurant_menus
         (store_id, name, description, menu_type, is_active, display_order, categories)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING *`,
      [storeId, name, description, menu_type, is_active, display_order,
       JSON.stringify(syncedCategories)]
    );
    return normalise(result.rows[0]);
  }

  static async update(menuId: string, input: Partial<MenuInput>): Promise<Menu> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let p = 0;

    if (input.name !== undefined) { p++; fields.push(`name = $${p}`); values.push(input.name); }
    if (input.description !== undefined) { p++; fields.push(`description = $${p}`); values.push(input.description); }
    if (input.menu_type !== undefined) { p++; fields.push(`menu_type = $${p}`); values.push(input.menu_type); }
    if (input.is_active !== undefined) { p++; fields.push(`is_active = $${p}`); values.push(input.is_active); }
    if (input.display_order !== undefined) { p++; fields.push(`display_order = $${p}`); values.push(input.display_order); }
    if (input.categories !== undefined) {
      const syncedCategories = await this.syncProducts(input.categories);
      p++; fields.push(`categories = $${p}::jsonb`); values.push(JSON.stringify(syncedCategories));
    }

    if (fields.length === 0) {
      const existing = await this.findById(menuId);
      if (!existing) throw new Error('Menu not found');
      return existing;
    }

    p++;
    values.push(menuId);
    const result = await this.query<RawMenu>(
      `UPDATE restaurant_menus SET ${fields.join(', ')} WHERE menu_id = $${p} RETURNING *`,
      values
    );
    if (!result.rows[0]) throw new Error('Menu not found');
    return normalise(result.rows[0]);
  }

  static async delete(menuId: string): Promise<boolean> {
    const result = await this.query(
      'DELETE FROM restaurant_menus WHERE menu_id = $1',
      [menuId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
