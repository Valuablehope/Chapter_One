import bcrypt from 'bcryptjs';
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

const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

