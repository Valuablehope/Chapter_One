const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'Chapter_One',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function run() {
  const result = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'sale_items';
  `);
  console.log('sale_items columns:', result.rows);
  const result2 = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'purchase_order_items';
  `);
  console.log('purchase_order_items columns:', result2.rows);
  pool.end();
}
run().catch(console.error);
