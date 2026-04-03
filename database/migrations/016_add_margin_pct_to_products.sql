-- Add margin_pct explicitly to support stable scaling
ALTER TABLE products ADD COLUMN margin_pct NUMERIC(10,2);

-- Backfill legacy products to automatically populate their percentage.
UPDATE products 
SET margin_pct = ((sale_price - list_price) / list_price) * 100 
WHERE list_price IS NOT NULL 
  AND list_price > 0 
  AND sale_price IS NOT NULL;
