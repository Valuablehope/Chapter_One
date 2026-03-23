-- Remove legacy menu JSON column from store_settings.
-- Canonical menu data is stored in public.restaurant_menus.
ALTER TABLE IF EXISTS public.store_settings
DROP COLUMN IF EXISTS restaurant_menus;

