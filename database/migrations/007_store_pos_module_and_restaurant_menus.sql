-- POS module type and restaurant configuration (menus, tables)
-- Apply this migration to the database used by the API, then restart the Node process
-- so StoreSettingsModel refreshes its column cache and new fields persist correctly.

ALTER TABLE store_settings
ADD COLUMN IF NOT EXISTS pos_module_type TEXT NOT NULL DEFAULT 'store',
ADD COLUMN IF NOT EXISTS restaurant_table_count INTEGER NULL,
ADD COLUMN IF NOT EXISTS restaurant_track_guests_per_table BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS restaurant_menus JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_settings_pos_module_type_check'
  ) THEN
    ALTER TABLE store_settings
      ADD CONSTRAINT store_settings_pos_module_type_check
      CHECK (pos_module_type IN ('store', 'retail_store', 'restaurant'));
  END IF;
END $$;

COMMENT ON COLUMN store_settings.pos_module_type IS 'POS mode: store, retail_store, or restaurant';
COMMENT ON COLUMN store_settings.restaurant_table_count IS 'Number of tables when pos_module_type is restaurant';
COMMENT ON COLUMN store_settings.restaurant_track_guests_per_table IS 'Whether to assign guest count per table';
COMMENT ON COLUMN store_settings.restaurant_menus IS 'JSON array: menus with categories and priced items';
