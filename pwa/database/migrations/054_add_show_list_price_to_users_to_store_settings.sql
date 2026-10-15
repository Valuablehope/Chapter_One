-- Add show_list_price_to_users to store_settings table
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_list_price_to_users BOOLEAN DEFAULT true;
