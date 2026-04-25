import { Client } from 'pg';
import { hashPassword } from '../utils/password';

async function createTestUser() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const fullName = process.argv[4] || 'Test Administrator';
  const role = process.argv[5] || 'admin';

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
    throw new Error('Failed to connect to database for user creation.');
  }

  let client: Client | null = null;
  try {
    client = await createClientWithRetry();
    
    // Check if user exists
    // Check if user exists
    const existingUser = await client.query(
      'SELECT user_id, username FROM app_users WHERE LOWER(username) = $1',
      [username.toLowerCase()]
    );

    const hashedPassword = await hashPassword(password);

    if (existingUser.rows.length > 0) {
      // Update existing user
      await client.query(
        'UPDATE app_users SET password_hash = $1, full_name = $2, role = $3, is_active = true WHERE user_id = $4',
        [hashedPassword, fullName, role, existingUser.rows[0].user_id]
      );
      console.log(`✅ Updated user: ${username}`);
      console.log(`   Password: ${password}`);
    } else {
      // Create new user
      await client.query(
        'INSERT INTO app_users (username, full_name, role, password_hash, is_active) VALUES ($1, $2, $3, $4, true)',
        [username.toLowerCase(), fullName, role, hashedPassword]
      );
      console.log(`✅ Created user: ${username}`);
      console.log(`   Password: ${password}`);
    }

    console.log(`\n📝 Login credentials:`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${role}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) await client.end();
    process.exit(0);
  }
}

createTestUser();











