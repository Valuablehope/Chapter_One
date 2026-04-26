-- Add show_lbp_price column to store_settings
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_lbp_price BOOLEAN DEFAULT TRUE;
