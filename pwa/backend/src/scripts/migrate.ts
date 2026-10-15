import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // Also try default location

// Exit codes: 0 = success, 1 = migration/SQL failure, 2 = database unreachable.
// The Electron main process uses code 2 to offer the Setup Wizard instead of
// aborting startup with a fatal error.
const EXIT_MIGRATION_FAILED = 1;
const EXIT_DB_UNREACHABLE = 2;

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH',
  '28P01', // invalid_password
  '28000', // invalid_authorization_specification
  '3D000', // invalid_catalog_name (database does not exist)
  '57P03', // cannot_connect_now (server starting up)
]);

// Detects errors that mean "PostgreSQL is not reachable/authenticable" as
// opposed to a genuine migration failure. Node may wrap multiple connection
// attempts (IPv4 + IPv6) in an AggregateError, so check nested errors too.
function isConnectionError(err: any): boolean {
  if (!err) return false;
  if (err.code && CONNECTION_ERROR_CODES.has(err.code)) return true;
  if (Array.isArray(err.errors) && err.errors.some((e: any) => isConnectionError(e))) return true;
  return typeof err.message === 'string' && err.message.includes('Failed to connect to database after retries');
}

// AggregateError (multiple connection attempts) has an empty .message, so
// unwrap nested errors to produce a human-readable single-line description.
function describeError(err: any): string {
  if (!err) return 'Unknown error';
  if (Array.isArray(err.errors) && err.errors.length > 0) {
    return err.errors.map((e: any) => e?.message || String(e)).join('; ');
  }
  return err.message || String(err);
}

// SHA-256 of each legacy migration file's content as of the release that
// introduced this check (computed from database/migrations/*.sql). The
// pre-seed step below only trusts a legacy database as "already having run"
// a file whose on-disk content still matches — a mismatch means the shipped
// migration evolved since this DB last ran something like it, and blindly
// marking it applied could silently skip schema changes it actually needs.
const LEGACY_MIGRATION_CHECKSUMS: Record<string, string> = {
  '000_base_schema.sql': 'b45497129aa27f1b62c5247c5b1fc8112c88009159834af53f7bac5fa0f15be4',
  '001_create_receipt_counters.sql': '1fe888b9047cf4a825532c113b38443f929a5677b59467f02cf59970e57a3908',
  '002_ensure_stock_balances_table.sql': '97c71e0a172590c40fedbcaaee0a7b54b98ed0782186fdf1a9613c87e72efc91',
  '003_add_fulltext_search.sql': 'ad65ee323976dca9389d73430980c8e5d28443ca4688777b720f62db41f704c3',
  '004_add_client_sale_id.sql': 'b4a3a67328b4603fd896e3eb8dcf03f16dea52035f4db3ea565e41357f2be49f',
  '005_restore_missing_tables.sql': '050699b37056a9d5909a5ad18d890aa8c177007906cdea9db2e3291f48f012ca',
  '006_add_missing_store_settings_columns.sql': '5f97003cf2ba0a34eff992de3bb9b365d3c03737567f8f0bd32dc3ae0f1dc4b1',
  '007_store_pos_module_and_restaurant_menus.sql': '210907d1452dd5e6431d9d8d570f6f39a3939efee5e75547803aa7ca3edc2fb8',
  '008_ensure_public_store_settings_restaurant_columns.sql': '965499fbc6d176f12d83c300f14a7cf6baffb2e8c1dc782c84733a461077a7db',
  '009_add_restaurant_sales_context.sql': '2465b720a055dd5e5673c7666d93bdddce81c5fa90e266352d2a6d01a1a794c0',
  '010_restaurant_menus_table.sql': '12aaaade6f55782e0a7a637462048d7d1e138ac55a7e1847716029140be836c8',
  '011_drop_legacy_store_settings_restaurant_menus.sql': '8c155b9d56e6522a175e0fe417a7144d004e8679017d2af351f4fb57b68fa840',
  '012_add_product_unit_of_measure.sql': 'fe0855a47026e0f3ef4b9dbb2c03b877985f29a54482a518484782f106f721ad',
  '013_add_product_types.sql': '4f11d1bbf0e0f9f7370f24132974d7b417b3dc0cfaf10853272f70605616c260',
  '014_move_display_on_pos.sql': 'e5af880aadff22110050ee2c3e457e94e5d8d654110644d64afa82d0e85cf4de',
  '015_alter_qty_to_numeric.sql': 'b61456aaa207c4769dae8cd3f1264de44388bfd9329d862f46389e3444e91239',
  '016_add_margin_pct_to_products.sql': '374e4aa0dc9e682b6029212218d90b0504dc0433c4e6b763efc7dd1acfaee716',
  '017_add_cancelled_to_sale_status.sql': 'a76fa4760b0fed6fefb918a2784c3a01281d0efb612398cefb4fbfb592cb7afd',
  '018_add_cancelled_to_movement_reason.sql': '04ad5a1d09f02eb7a1878eb20fbe9294f075671009dc69ada14f6bf12e52eca5',
  '019_add_lbp_exchange_rate.sql': '292e4bbcdf4705e87871618d8c59a416764d1d447a536bb516011235e24b03a5',
  'performance_indexes.sql': '953908059bbb004eef12cbc8575b28bb33291feb1910a5e9638b55d7d0940efb',
};

function sha256File(filePath: string): string | null {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch {
    return null;
  }
}

async function runMigrations() {
  let DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME;

  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    DB_HOST = url.hostname;
    DB_PORT = url.port || '5432';
    DB_USER = decodeURIComponent(url.username);
    DB_PASSWORD = decodeURIComponent(url.password);
    DB_NAME = url.pathname.slice(1);
  } else {
    DB_HOST = process.env.DB_HOST;
    DB_PORT = process.env.DB_PORT;
    DB_USER = process.env.DB_USER;
    DB_PASSWORD = process.env.DB_PASSWORD;
    DB_NAME = process.env.DB_NAME;
  }

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
  } catch (error: any) {
    if (isConnectionError(error)) {
      console.error(`Could not reach PostgreSQL at ${DB_HOST}:${DB_PORT || 5432} — ${describeError(error)}`);
      process.exit(EXIT_DB_UNREACHABLE);
    }
    console.error(`Failed to initialize database: ${describeError(error)}`);
    process.exit(EXIT_MIGRATION_FAILED);
  } finally {
    if (initClient) await initClient.end();
  }

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

    // Find all .sql files in the migrations directory (resolved up front so the
    // legacy pre-seed check below can verify file content, not just filenames).
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

    // Detect if this is an upgrade of a legacy/existing database
    const checkTableRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'app_users'
      )
    `);
    const isExistingDb = checkTableRes.rows[0].exists;

    if (isExistingDb) {
      const countRes = await client.query('SELECT COUNT(*) FROM migrations');
      const count = parseInt(countRes.rows[0].count, 10);
      if (count === 0) {
        console.log('Existing database detected. Verifying legacy migration files before pre-seeding...');
        let seeded = 0;
        let skipped = 0;
        for (const name of Object.keys(LEGACY_MIGRATION_CHECKSUMS)) {
          const expectedHash = LEGACY_MIGRATION_CHECKSUMS[name];
          const actualHash = sha256File(path.join(migrationsDir, name));
          if (actualHash === expectedHash) {
            await client.query('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
            seeded++;
          } else {
            skipped++;
            console.warn(
              `⚠️ Legacy migration "${name}" content does not match the expected checksum ` +
              `(${actualHash ?? 'file unreadable'} vs ${expectedHash}). NOT pre-seeding it — ` +
              `it will be executed normally below instead of assumed already applied.`
            );
          }
        }
        console.log(`✅ Legacy migration pre-seeding done: ${seeded} pre-seeded, ${skipped} left for normal execution.`);
      }
    }

    // Get executed migrations
    const executedRes = await client.query('SELECT name FROM migrations');
    const executedMigrations = new Set(executedRes.rows.map(r => r.name));

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
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to execute migration ${file}: ${err?.message || err}`);
        throw new Error(`Migration "${file}" failed: ${err?.message || err}`);
      }
    }

    console.log('All migrations completed successfully.');

  } catch (error: any) {
    console.error(`Migration failed: ${describeError(error)}`);
    process.exit(isConnectionError(error) ? EXIT_DB_UNREACHABLE : EXIT_MIGRATION_FAILED);
  } finally {
    if (client) await client.end();
  }
}

runMigrations();
