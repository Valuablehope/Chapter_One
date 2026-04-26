-- Add ui_resolution column to store_settings table
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS ui_resolution VARCHAR(50) DEFAULT 'auto';
