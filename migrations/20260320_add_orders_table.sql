-- Migration file example
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending'
);
