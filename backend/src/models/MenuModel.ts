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
  created_at: string;
  updated_at: string;
}

interface MenuProductRow {
  menu_id: string;
  product_id: string;
  name: string;
  sale_price: number | null;
  list_price: number | null;
  menu_category: string | null;
  menu_display_order: number;
  menu_note: string | null;
}

const UNCATEGORIZED = 'Uncategorized';

export class MenuModel extends BaseModel {

  // Products assigned to each menu, grouped into categories — this is the
  // live read model that replaces the old categories JSONB column.
  private static async attachCategories(menus: RawMenu[]): Promise<Menu[]> {
    if (menus.length === 0) return [];
    const menuIds = menus.map(m => m.menu_id);

    const result = await this.query<MenuProductRow>(
      `SELECT menu_id, product_id, name, sale_price, list_price, menu_category, menu_display_order, menu_note
       FROM products
       WHERE menu_id = ANY($1::uuid[])
       ORDER BY menu_display_order ASC, name ASC`,
      [menuIds]
    );

    const byMenu = new Map<string, Map<string, MenuCategoryRow>>();
    const catOrder = new Map<string, Map<string, number>>();

    for (const row of result.rows) {
      let cats = byMenu.get(row.menu_id);
      if (!cats) { cats = new Map(); byMenu.set(row.menu_id, cats); }
      let orders = catOrder.get(row.menu_id);
      if (!orders) { orders = new Map(); catOrder.set(row.menu_id, orders); }

      const catName = row.menu_category?.trim() || UNCATEGORIZED;
      if (!cats.has(catName)) cats.set(catName, { name: catName, items: [] });
      if (!orders.has(catName)) orders.set(catName, row.menu_display_order);

      cats.get(catName)!.items.push({
        name: row.name,
        price: Number(row.sale_price ?? row.list_price ?? 0),
        description: row.menu_note ?? undefined,
        product_id: row.product_id,
      });
    }

    return menus.map(m => {
      const cats = byMenu.get(m.menu_id);
      const orders = catOrder.get(m.menu_id);
      const categories = cats
        ? Array.from(cats.values()).sort(
            (a, b) => (orders?.get(a.name) ?? 0) - (orders?.get(b.name) ?? 0)
          )
        : [];
      return { ...m, categories };
    });
  }

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

    const data = await this.attachCategories(result.rows);
    return { data, total };
  }

  static async findById(menuId: string): Promise<Menu | null> {
    const result = await this.query<RawMenu>(
      'SELECT * FROM restaurant_menus WHERE menu_id = $1',
      [menuId]
    );
    const row = result.rows[0];
    if (!row) return null;
    const [menu] = await this.attachCategories([row]);
    return menu;
  }

  static async create(storeId: string, input: MenuInput): Promise<Menu> {
    const {
      name,
      description = null,
      menu_type = 'regular',
      is_active = true,
      display_order = 0,
    } = input;

    const result = await this.query<RawMenu>(
      `INSERT INTO restaurant_menus
         (store_id, name, description, menu_type, is_active, display_order)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [storeId, name, description, menu_type, is_active, display_order]
    );
    const [menu] = await this.attachCategories([result.rows[0]]);
    return menu;
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
    const [menu] = await this.attachCategories([result.rows[0]]);
    return menu;
  }

  static async delete(menuId: string): Promise<boolean> {
    const result = await this.query(
      'DELETE FROM restaurant_menus WHERE menu_id = $1',
      [menuId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
