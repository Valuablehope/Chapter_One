import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Find root directory by looking for .env file
// Go up from backend/src/config/ (3 levels) or backend/dist/config/ (3 levels)
function findEnvFile(): string {
  let currentDir = __dirname;
  const maxDepth = 5; // Prevent infinite loop
  
  for (let i = 0; i < maxDepth; i++) {
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached filesystem root
    currentDir = parentDir;
  }
  
  // Fallback: try root directory (3 levels up from backend/src/config)
  return path.resolve(__dirname, '../../../.env');
}

const envPath = findEnvFile();
dotenv.config({ path: envPath });

// Debug: Log which .env file is being used
if (process.env.NODE_ENV !== 'production') {
  console.log(`📄 Loading .env from: ${envPath}`);
  console.log(`📄 DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
}

// Support both DATABASE_URL and individual variables
let dbConfig: PoolConfig;

// Debug: Log which config method is being used
if (process.env.DATABASE_URL) {
  console.log('📦 Using DATABASE_URL connection string');
  // Use connection string if provided
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
} else {
  console.log('📦 Using individual database variables');
  // Use individual variables
  const dbPassword = process.env.DB_PASSWORD !== undefined 
    ? String(process.env.DB_PASSWORD) 
    : '';

  if (!dbPassword && process.env.NODE_ENV !== 'test') {
    console.warn('⚠️  DB_PASSWORD is not set in .env file');
    console.warn('   Database connection will likely fail.');
    console.warn('   Please set DB_PASSWORD or DATABASE_URL in your .env file');
  }

  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'Chapter_One',
    user: process.env.DB_USER || 'postgres',
    password: dbPassword,
    max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

// Create connection pool
export const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(-1);
  }
});

// Test connection (non-blocking)
if (process.env.NODE_ENV !== 'test') {
  pool.query('SELECT NOW()')
    .then(() => {
      console.log('✅ Database connected successfully');
    })
    .catch((err: Error) => {
      console.error('❌ Database connection failed:', err.message);
      if (err.message.includes('password') || err.message.includes('SASL')) {
        console.error('   → Check your database credentials in .env file');
        console.error('   → Make sure .env file exists in the root directory');
        console.error('   → Restart the server after updating .env');
      }
    });
}

export default pool;

