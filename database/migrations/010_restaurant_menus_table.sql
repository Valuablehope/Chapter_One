-- Migration 010: Dedicated restaurant_menus table
-- Replaces the flat restaurant_menus JSONB column in store_settings
-- with a proper relational table for full CRUD management.

CREATE TABLE IF NOT EXISTS restaurant_menus (
  menu_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID          NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
  name          TEXT          NOT NULL,
  description   TEXT,
  menu_type     TEXT          NOT NULL DEFAULT 'regular'
                              CHECK (menu_type IN ('regular','holiday','seasonal','event','special')),
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  display_order INT           NOT NULL DEFAULT 0,
  categories    JSONB         NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_menus_store_id
  ON restaurant_menus(store_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_menus_store_active
  ON restaurant_menus(store_id, is_active);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION set_restaurant_menus_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurant_menus_updated_at ON restaurant_menus;
CREATE TRIGGER trg_restaurant_menus_updated_at
  BEFORE UPDATE ON restaurant_menus
  FOR EACH ROW EXECUTE FUNCTION set_restaurant_menus_updated_at();
