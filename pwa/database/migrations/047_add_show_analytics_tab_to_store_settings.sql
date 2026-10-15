-- Add show_analytics_tab to store_settings table
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_analytics_tab BOOLEAN DEFAULT true;
