-- Create product_types table
CREATE TABLE IF NOT EXISTS product_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert existing unique product types from products table into product_types
INSERT INTO product_types (name)
SELECT DISTINCT product_type FROM products WHERE product_type IS NOT NULL AND product_type != ''
ON CONFLICT (name) DO NOTHING;

-- Add display_on_pos to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS display_on_pos BOOLEAN DEFAULT FALSE;
