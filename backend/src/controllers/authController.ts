import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

interface LoginRequest {
  username: string;
  password: string;
}

export const login = asyncHandler(
  async (req: Request<{}, {}, LoginRequest>, res: Response, next: NextFunction) => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      throw new CustomError('Username and password are required', 400);
    }

    // Find user by username (case-insensitive)
    const searchUsername = username.toLowerCase().trim();
    const userResult = await pool.query(
      'SELECT user_id, username, full_name, role, password_hash, is_active FROM app_users WHERE LOWER(username) = $1',
      [searchUsername]
    );

    if (userResult.rows.length === 0) {
      logger.warn(`Failed login attempt for username: ${username} (searched as: ${searchUsername})`);
      throw new CustomError('Invalid username or password', 401);
    }

    const user = userResult.rows[0];

    // Check if user is active
    if (!user.is_active) {
      throw new CustomError('Account is deactivated', 403);
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      logger.warn(`Failed login attempt for username: ${username} - password mismatch`);
      throw new CustomError('Invalid username or password', 401);
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.user_id,
      username: user.username,
      role: user.role,
    });

    logger.info(`User logged in: ${user.username} (${user.role})`);

    // Return user info and token
    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          userId: user.user_id,
          username: user.username,
          fullName: user.full_name,
          role: user.role,
        },
      },
    });
  }
);

export const verifyToken = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // This endpoint is protected by auth middleware
    // If we reach here, token is valid
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  }
);

