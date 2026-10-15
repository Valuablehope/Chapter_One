-- Ensure restaurant settings columns exist in public.store_settings.
-- This is intentionally idempotent and no-op when columns are already present.

ALTER TABLE IF EXISTS public.store_settings
ADD COLUMN IF NOT EXISTS pos_module_type TEXT NOT NULL DEFAULT 'store',
ADD COLUMN IF NOT EXISTS restaurant_table_count INTEGER NULL,
ADD COLUMN IF NOT EXISTS restaurant_track_guests_per_table BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS restaurant_menus JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_settings'
      AND column_name = 'timezone'
  ) THEN
    ALTER TABLE public.store_settings DROP COLUMN timezone;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'store_settings'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'store_settings_pos_module_type_check'
  ) THEN
    ALTER TABLE public.store_settings
      ADD CONSTRAINT store_settings_pos_module_type_check
      CHECK (pos_module_type IN ('store', 'retail_store', 'restaurant'));
  END IF;
END $$;
