-- Add receipt_logo_url to store_settings table
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS receipt_logo_url VARCHAR(500);
