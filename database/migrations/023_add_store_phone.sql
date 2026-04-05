-- Store contact phone for receipts and admin
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN stores.phone IS 'Store phone number for receipts and contact';
