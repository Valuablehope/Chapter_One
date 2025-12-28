import { Request, Response } from 'express';
import { UserModel, UserFilters } from '../models/UserModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { hashPassword } from '../utils/password';

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const filters: UserFilters = {
    search: req.query.search as string,
    role: req.query.role as 'cashier' | 'manager' | 'admin' | undefined,
    is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  const result = await UserModel.findAll(filters);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await UserModel.findById(id);

  if (!user) {
    throw new CustomError('User not found', 404);
  }

  res.json({
    success: true,
    data: user,
  });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { username, full_name, role, password, is_active } = req.body;

  if (!username || !full_name || !password) {
    throw new CustomError('Username, full name, and password are required', 400);
  }

  // Check if username exists
  const usernameExists = await UserModel.checkUsernameExists(username);
  if (usernameExists) {
    throw new CustomError('Username already exists', 400);
  }

  const password_hash = await hashPassword(password);
  const user = await UserModel.create({
    username,
    full_name,
    role: role || 'cashier',
    password_hash,
    is_active: is_active !== undefined ? is_active : true,
  });

  res.status(201).json({
    success: true,
    data: user,
  });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { full_name, role, password, is_active } = req.body;

  const existing = await UserModel.findById(id);
  if (!existing) {
    throw new CustomError('User not found', 404);
  }

  const updates: any = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (role !== undefined) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;
  if (password) {
    updates.password_hash = await hashPassword(password);
  }

  const user = await UserModel.update(id, updates);
  res.json({
    success: true,
    data: user,
  });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Prevent deleting yourself
  if (req.user?.userId === id) {
    throw new CustomError('Cannot delete your own account', 400);
  }

  const deleted = await UserModel.delete(id);
  if (!deleted) {
    throw new CustomError('User not found', 404);
  }

  res.json({
    success: true,
    message: 'User deleted successfully',
  });
});











