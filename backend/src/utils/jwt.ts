import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Find and load .env from root directory
function findEnvFile(): string {
  let currentDir = __dirname;
  const maxDepth = 5;
  for (let i = 0; i < maxDepth; i++) {
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) return envPath;
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  return path.resolve(__dirname, '../../../.env');
}

dotenv.config({ path: findEnvFile() });

// Enforce JWT_SECRET in all environments
const JWT_SECRET: string = process.env.JWT_SECRET || '';

// Require JWT_SECRET in all environments (no development bypass)
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET must be set in all environments. ' +
    'Please set JWT_SECRET in your .env file with at least 32 characters.'
  );
}

// Validate JWT_SECRET strength
if (JWT_SECRET.length < 32) {
  throw new Error(
    `JWT_SECRET must be at least 32 characters long. Current length: ${JWT_SECRET.length}. ` +
    'Please set a stronger JWT_SECRET in your .env file.'
  );
}

// Additional validation: ensure secret is not just whitespace
if (JWT_SECRET.trim().length < 32) {
  throw new Error(
    'JWT_SECRET must contain at least 32 non-whitespace characters. ' +
    'Please set a stronger JWT_SECRET in your .env file.'
  );
}

const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRY || process.env.JWT_EXPIRES_IN || '24h';

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

export const generateToken = (payload: TokenPayload): string => {
  // Validate JWT_SECRET before token generation
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET is not properly configured. Cannot generate token.');
  }
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): TokenPayload => {
  // Validate JWT_SECRET before token verification
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET is not properly configured. Cannot verify token.');
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export const decodeToken = (token: string): TokenPayload | null => {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
};

