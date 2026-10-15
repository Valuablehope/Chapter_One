-- Add opening_stock to movement_reason enum (safe: no-op if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'opening_stock'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'movement_reason')
  ) THEN
    ALTER TYPE movement_reason ADD VALUE 'opening_stock';
  END IF;
END$$;

-- One opening stock session per store (draft or committed)
CREATE TABLE IF NOT EXISTS opening_stock_sessions (
  session_id   UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id     UUID         NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
  reference    VARCHAR(100) NOT NULL,
  notes        TEXT,
  status       VARCHAR(20)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'committed')),
  committed_at TIMESTAMPTZ,
  committed_by UUID         REFERENCES app_users(user_id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by   UUID         REFERENCES app_users(user_id),
  UNIQUE(store_id)
);

-- Products and their initial quantities within a session
CREATE TABLE IF NOT EXISTS opening_stock_items (
  item_id    UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID    NOT NULL REFERENCES opening_stock_sessions(session_id) ON DELETE CASCADE,
  product_id UUID    NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  qty        INTEGER NOT NULL CHECK (qty > 0),
  UNIQUE(session_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_opening_stock_sessions_store
  ON opening_stock_sessions(store_id);

CREATE INDEX IF NOT EXISTS idx_opening_stock_items_session
  ON opening_stock_items(session_id);
