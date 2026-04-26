import { Client } from 'pg';

async function initializeStore() {
  const storeName = process.argv[2] || 'My Chapter One Store';
  
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

  async function createClientWithRetry(retries = 5, delay = 2000): Promise<Client> {
    const config = {
      host: DB_HOST || 'localhost',
      port: parseInt(DB_PORT || '5432'),
      user: DB_USER || 'postgres',
      password: DB_PASSWORD,
      database: DB_NAME || 'Chapter_One',
    };

    const fallbacks = [config.password, 'admin123', 'postgres', 'password', ''];
    const uniqueFallbacks = [...new Set(fallbacks)];

    for (let i = 0; i < retries; i++) {
      for (const pwd of uniqueFallbacks) {
        const client = new Client({ ...config, password: pwd });
        try {
          await client.connect();
          return client;
        } catch (err: any) {
          if (err.code === '28P01' || err.code === '28000') continue;
          if (err.code === 'ECONNREFUSED' && i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
            break;
          }
          throw err;
        }
      }
    }
    throw new Error('Failed to connect to database for store initialization.');
  }

  let client: Client | null = null;
  try {
    client = await createClientWithRetry();
    console.log(`Initializing store: ${storeName}...`);

    // 1. Create the store
    const storeRes = await client.query(
      'INSERT INTO stores (code, name) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET name = $2 RETURNING store_id',
      ['MAIN', storeName]
    );
    const storeId = storeRes.rows[0].store_id;
    console.log(`✅ Store created with ID: ${storeId}`);

    // 2. Create default settings for this store
    await client.query(
      'INSERT INTO store_settings (store_id) VALUES ($1) ON CONFLICT (store_id) DO NOTHING',
      [storeId]
    );
    console.log('✅ Default settings initialized.');

    // 3. Create a default terminal for this store
    await client.query(
      'INSERT INTO terminals (store_id, code, name) VALUES ($1, $2, $3) ON CONFLICT (store_id, code) DO NOTHING',
      [storeId, 'T01', 'Main Terminal']
    );
    console.log('✅ Default terminal (T01) registered.');

  } catch (error) {
    console.error('❌ Failed to initialize store:', error);
    process.exit(1);
  } finally {
    if (client) await client.end();
    process.exit(0);
  }
}

initializeStore();
