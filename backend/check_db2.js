const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:test_123@localhost:5433/Chapter_One'
});

async function run() {
  const result = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('sale_items', 'purchase_order_items', 'stock_balances', 'stock_movements');
  `);
  console.log('Columns:', JSON.stringify(result.rows, null, 2));
  pool.end();
}
run().catch(console.error);
