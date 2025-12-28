import { pool } from '../config/database';
import { hashPassword } from '../utils/password';

/**
 * Utility script to create or update a test user
 * Run with: tsx src/scripts/createTestUser.ts
 */

async function createTestUser() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const fullName = process.argv[4] || 'Test Administrator';
  const role = process.argv[5] || 'admin';

  try {
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT user_id, username FROM app_users WHERE LOWER(username) = $1',
      [username.toLowerCase()]
    );

    const hashedPassword = await hashPassword(password);

    if (existingUser.rows.length > 0) {
      // Update existing user
      await pool.query(
        'UPDATE app_users SET password_hash = $1, full_name = $2, role = $3, is_active = true WHERE user_id = $4',
        [hashedPassword, fullName, role, existingUser.rows[0].user_id]
      );
      console.log(`✅ Updated user: ${username}`);
      console.log(`   Password: ${password}`);
    } else {
      // Create new user
      await pool.query(
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
    await pool.end();
    process.exit(0);
  }
}

createTestUser();











