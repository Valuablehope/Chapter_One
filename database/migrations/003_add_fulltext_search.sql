-- Migration: Add full-text search support for products
-- This improves search performance significantly for large product catalogs

-- Add tsvector column for full-text search on product name
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS name_tsvector tsvector;

-- Create index on tsvector column for fast full-text search
CREATE INDEX IF NOT EXISTS idx_products_name_tsvector 
ON products USING gin(name_tsvector);

-- Create function to update tsvector when product name changes
CREATE OR REPLACE FUNCTION update_product_name_tsvector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name_tsvector := to_tsvector('english', COALESCE(NEW.name, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update tsvector on insert/update
DROP TRIGGER IF EXISTS trigger_update_product_name_tsvector ON products;
CREATE TRIGGER trigger_update_product_name_tsvector
  BEFORE INSERT OR UPDATE OF name ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_name_tsvector();

-- Update existing products to populate tsvector column
UPDATE products 
SET name_tsvector = to_tsvector('english', COALESCE(name, ''))
WHERE name_tsvector IS NULL;

