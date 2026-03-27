const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgres://postgres:test_123@localhost:5433/Chapter_One'
});

async function run() {
  const sqlPath = path.join(__dirname, '../database/migrations/015_alter_qty_to_numeric.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('COMMIT');
    console.log('Migration applied successfully.');
  } catch (err) {
    await pool.query('ROLLBACK');
    fs.writeFileSync('error.json', JSON.stringify({
      message: err.message,
      detail: err.detail,
    }, null, 2));
    console.error('Migration failed, check error.json', err.message);
  }
  pool.end();
}
run();
