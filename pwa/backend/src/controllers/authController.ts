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

export interface VerifiedUser {
  userId: string;
  username: string;
  fullName: string;
  role: string;
}

export type CredentialCheckResult =
  | { ok: true; user: VerifiedUser }
  | { ok: false; reason: 'NOT_FOUND' | 'INACTIVE' | 'BAD_PASSWORD' };

/**
 * Verifies a username/password against app_users. Shared by the local HTTP
 * login route and the mobile companion login relay (mobileLoginRelay.ts) so
 * both paths enforce identical rules against the same local credential store.
 */
export async function verifyCredentials(username: string, password: string): Promise<CredentialCheckResult> {
  const searchUsername = username.toLowerCase().trim();
  const userResult = await pool.query(
    'SELECT user_id, username, full_name, role, password_hash, is_active FROM app_users WHERE LOWER(username) = $1',
    [searchUsername]
  );

  if (userResult.rows.length === 0) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  const user = userResult.rows[0];

  if (!user.is_active) {
    return { ok: false, reason: 'INACTIVE' };
  }

  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    return { ok: false, reason: 'BAD_PASSWORD' };
  }

  return {
    ok: true,
    user: {
      userId: user.user_id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
    },
  };
}

export const login = asyncHandler(
  async (req: Request<Record<string, string>, unknown, LoginRequest>, res: Response, next: NextFunction) => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      throw new CustomError('Username and password are required', 400);
    }

    const result = await verifyCredentials(username, password);

    if (!result.ok) {
      logger.warn(`Failed login attempt for username: ${username} (${result.reason})`);
      if (result.reason === 'INACTIVE') {
        throw new CustomError('Account is deactivated', 403);
      }
      throw new CustomError('Invalid username or password', 401);
    }

    const user = result.user;

    // Generate JWT token
    const token = generateToken({
      userId: user.userId,
      username: user.username,
      role: user.role,
    });

    logger.info(`User logged in: ${user.username} (${user.role})`);

    // Set httpOnly cookie with token
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Must be false for local http://127.0.0.1
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    // Return user info (token is in cookie, not in response body)
    res.status(200).json({
      success: true,
      data: {
        user: {
          userId: user.userId,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
        },
        token,
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

export const refreshToken = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // This endpoint is protected by auth middleware
    // If we reach here, token is valid but may be expiring soon
    // Generate a new token with extended expiry
    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    const newToken = generateToken({
      userId: req.user.userId,
      username: req.user.username,
      role: req.user.role,
    });

    logger.info(`Token refreshed for user: ${req.user.username}`);

    // Set httpOnly cookie with new token
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: false, // Must be false for local http://127.0.0.1
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    // Return user info (token is in cookie, not in response body)
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
        token: newToken,
      },
    });
  }
);

export const logout = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Clear the httpOnly cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: false, // Must be false for local http://127.0.0.1
      sameSite: 'lax',
      path: '/',
    });

    logger.info(`User logged out: ${req.user?.username || 'unknown'}`);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
);

