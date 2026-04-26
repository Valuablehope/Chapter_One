import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // Also try default location

async function runMigrations() {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    console.error('Missing database configuration in environment variables.');
    process.exit(1);
  }

  console.log(`Connecting to PostgreSQL at ${DB_HOST}:${DB_PORT || 5432} to ensure database "${DB_NAME}" exists...`);
  
  // Helper function to retry connection while service starts
  async function createClientWithRetry(config: any, retries = 10, delay = 3000): Promise<Client> {
    const fallbacks = [config.password, 'admin123', 'postgres', 'password', ''];
    const uniqueFallbacks = [...new Set(fallbacks)];

    for (let i = 0; i < retries; i++) {
      for (const pwd of uniqueFallbacks) {
        const client = new Client({ ...config, password: pwd });
        try {
          await client.connect();
          
          // If we connected with a fallback password, update it to the target password
          if (pwd !== config.password && config.password) {
            console.log(`Connected with fallback password. Synchronizing password to user's choice...`);
            try {
              await client.query(`ALTER ROLE "${config.user}" WITH PASSWORD '${config.password}'`);
              console.log(`✅ Password synchronized successfully.`);
            } catch (alterErr) {
              console.warn(`⚠️ Could not synchronize password:`, alterErr);
            }
          }
          
          return client;
        } catch (err: any) {
          // If it's a password error, try the next fallback immediately
          if (err.code === '28P01' || err.code === '28000') {
            continue; 
          }
          
          // If it's a connection error, wait and retry the whole loop
          if (err.code === 'ECONNREFUSED' && i < retries - 1) {
            console.log(`Connection refused (PostgreSQL might still be starting up). Waiting ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            break; // Break fallbacks loop to retry outer loop
          } else {
            throw err;
          }
        }
      }
    }
    throw new Error('Failed to connect to database after retries.');
  }

  const dbConfig = {
    host: DB_HOST,
    port: parseInt(DB_PORT || '5432'),
    user: DB_USER,
    password: DB_PASSWORD,
    database: 'postgres', // Connect to default db
  };

  let initClient: Client | null = null;
  try {
    initClient = await createClientWithRetry(dbConfig);
    const res = await initClient.query(`SELECT datname FROM pg_catalog.pg_database WHERE datname = $1`, [DB_NAME]);
    if (res.rowCount === 0) {
      console.log(`Database "${DB_NAME}" does not exist. Creating...`);
      await initClient.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`Database "${DB_NAME}" created successfully.`);
    } else {
      console.log(`Database "${DB_NAME}" already exists.`);
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  } finally {
    if (initClient) await initClient.end();
  }

  console.log(`Connecting to "${DB_NAME}" to run migrations...`);
  
  console.log(`Connecting to "${DB_NAME}" to run migrations...`);

  let client: Client | null = null;
  try {
    client = await createClientWithRetry({ ...dbConfig, database: DB_NAME });

    // Create a migrations table to track executed migrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get executed migrations
    const executedRes = await client.query('SELECT name FROM migrations');
    const executedMigrations = new Set(executedRes.rows.map(r => r.name));

    // Find all .sql files in the migrations directory
    let migrationsDir = '';
    
    const possibleDirs = [
      path.resolve(__dirname, '../../../database/migrations'), // Development
      path.resolve(process.cwd(), 'database/migrations'),        // Production root
      path.resolve(process.cwd(), 'resources/database/migrations'), // Production resources
    ];

    // If RESOURCES_PATH is explicitly passed (from Electron)
    if (process.env.RESOURCES_PATH) {
      possibleDirs.push(path.resolve(process.env.RESOURCES_PATH, 'database/migrations'));
    }

    for (const d of possibleDirs) {
      if (fs.existsSync(d)) {
        migrationsDir = d;
        break;
      }
    }

    if (!migrationsDir) {
      console.error('❌ Migrations directory not found in any of the expected locations.');
      process.exit(1);
    }

    console.log(`Using migrations from: ${migrationsDir}`);
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }

    for (const file of files) {
      if (executedMigrations.has(file)) {
        console.log(`Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`Executing migration: ${file}...`);
      const sqlPath = path.resolve(migrationsDir, file);
      
      const sql = fs.readFileSync(sqlPath, 'utf8');
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ ${file} executed successfully.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to execute migration ${file}:`, err);
        throw err;
      }
    }

    console.log('All migrations completed successfully.');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    if (client) await client.end();
  }
}

runMigrations();
