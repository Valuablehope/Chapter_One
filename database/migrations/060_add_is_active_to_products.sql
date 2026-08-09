-- Soft-deactivate flag: admins can disable a product without deleting it,
-- preserving its existing sales/purchase history. Defaults active for existing rows.
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active);
