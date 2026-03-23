import { Request, Response, NextFunction } from 'express';
import { MenuModel, MenuInput, MenuFilters, MenuType } from '../models/MenuModel';

function apiError(res: Response, status: number, message: string) {
  return res.status(status).json({ success: false, error: { message } });
}

export async function getMenus(req: Request, res: Response, next: NextFunction) {
  try {
    const { store_id, search, is_active, menu_type, page, limit } = req.query;
    if (!store_id) return apiError(res, 400, 'store_id is required');

    const filters: MenuFilters = {};
    if (search) filters.search = String(search);
    if (is_active !== undefined) filters.is_active = is_active === 'true';
    if (menu_type) filters.menu_type = String(menu_type) as MenuType;
    if (page) filters.page = parseInt(String(page), 10);
    if (limit) filters.limit = parseInt(String(limit), 10);

    const { data, total } = await MenuModel.findAll(String(store_id), filters);
    const p = filters.page ?? 1;
    const l = filters.limit ?? 50;

    return res.json({
      success: true,
      data,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.ceil(total / l),
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function getMenuById(req: Request, res: Response, next: NextFunction) {
  try {
    const menu = await MenuModel.findById(req.params.id);
    if (!menu) return apiError(res, 404, 'Menu not found');
    return res.json({ success: true, data: menu });
  } catch (err) {
    return next(err);
  }
}

export async function createMenu(req: Request, res: Response, next: NextFunction) {
  try {
    const { store_id, name, description, menu_type, is_active, display_order, categories } =
      req.body as { store_id: string } & MenuInput;

    if (!store_id) return apiError(res, 400, 'store_id is required');
    if (!name?.trim()) return apiError(res, 400, 'name is required');

    const menu = await MenuModel.create(store_id, {
      name: name.trim(),
      description: description ?? null,
      menu_type,
      is_active,
      display_order,
      categories,
    });
    return res.status(201).json({ success: true, data: menu });
  } catch (err) {
    return next(err);
  }
}

export async function updateMenu(req: Request, res: Response, next: NextFunction) {
  try {
    const input: Partial<MenuInput> = {};
    const { name, description, menu_type, is_active, display_order, categories } = req.body;

    if (name !== undefined) input.name = String(name).trim();
    if (description !== undefined) input.description = description;
    if (menu_type !== undefined) input.menu_type = menu_type as MenuType;
    if (is_active !== undefined) input.is_active = Boolean(is_active);
    if (display_order !== undefined) input.display_order = Number(display_order);
    if (categories !== undefined) input.categories = categories;

    if (input.name !== undefined && !input.name) {
      return apiError(res, 400, 'name cannot be empty');
    }

    const menu = await MenuModel.update(req.params.id, input);
    return res.json({ success: true, data: menu });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Menu not found') {
      return apiError(res, 404, 'Menu not found');
    }
    return next(err);
  }
}

export async function deleteMenu(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await MenuModel.delete(req.params.id);
    if (!deleted) return apiError(res, 404, 'Menu not found');
    return res.json({ success: true, message: 'Menu deleted' });
  } catch (err) {
    return next(err);
  }
}
