-- Move display_on_pos from products to product_types
ALTER TABLE products DROP COLUMN IF EXISTS display_on_pos;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS display_on_pos BOOLEAN DEFAULT FALSE;
