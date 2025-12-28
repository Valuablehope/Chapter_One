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

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRY || process.env.JWT_EXPIRES_IN || '24h';

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): TokenPayload => {
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

