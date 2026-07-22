-- Stock disposals: write off inventory (expired/damaged/etc) with a reason,
-- subtracting from stock_balances via a normal 'disposed' stock_movements entry.

-- Add 'disposed' to movement_reason enum (safe: no-op if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'disposed'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'movement_reason')
  ) THEN
    ALTER TYPE movement_reason ADD VALUE 'disposed';
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Dispose reasons
-- store_id NULL  = system-wide (pre-seeded, not deletable)
-- store_id set   = custom reason for that store (admin/manager-managed)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispose_reasons (
  reason_id   SERIAL PRIMARY KEY,
  store_id    UUID         REFERENCES stores(store_id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  is_system   BOOLEAN      NOT NULL DEFAULT false,
  sort_order  INTEGER      NOT NULL DEFAULT 100,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dispose_reason_global_name
  ON dispose_reasons (name) WHERE store_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_dispose_reason_store_name
  ON dispose_reasons (store_id, name) WHERE store_id IS NOT NULL;

INSERT INTO dispose_reasons (name, is_system, sort_order) VALUES
  ('Expired',                  true, 1),
  ('Damaged',                  true, 2),
  ('Spoiled / Perished',       true, 3),
  ('Broken',                   true, 4),
  ('Quality Control Failure',  true, 5),
  ('Theft / Loss',             true, 6),
  ('Sample / Testing',         true, 7),
  ('Other',                    true, 8)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_dispose_reasons_store ON dispose_reasons(store_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Disposal header — one row per "Dispose items" submission
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_disposals (
  disposal_id       UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id          UUID          NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
  notes             TEXT,
  total_qty         NUMERIC(10,3) NOT NULL DEFAULT 0,
  total_value_lost  NUMERIC(12,2) NOT NULL DEFAULT 0,
  disposed_by       UUID          REFERENCES app_users(user_id),
  disposed_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_disposals_store_date ON stock_disposals(store_id, disposed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Disposal line items — each has its own reason, qty and snapshotted cost
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_disposal_items (
  disposal_item_id UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  disposal_id      UUID          NOT NULL REFERENCES stock_disposals(disposal_id) ON DELETE CASCADE,
  product_id       UUID          NOT NULL REFERENCES products(product_id),
  reason_id        INTEGER       NOT NULL REFERENCES dispose_reasons(reason_id),
  qty              NUMERIC(10,3) NOT NULL CHECK (qty > 0),
  unit_cost        NUMERIC(12,2) NOT NULL DEFAULT 0,
  value_lost       NUMERIC(12,2) NOT NULL DEFAULT 0,
  note             TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_disposal_items_disposal ON stock_disposal_items(disposal_id);
CREATE INDEX IF NOT EXISTS idx_stock_disposal_items_product  ON stock_disposal_items(product_id);

COMMENT ON TABLE dispose_reasons IS 'Reasons selectable when disposing stock (system-wide + per-store custom)';
COMMENT ON TABLE stock_disposals IS 'Header record for a "Dispose items" submission';
COMMENT ON TABLE stock_disposal_items IS 'Per-product lines of a disposal: qty removed, reason, snapshotted cost';
COMMENT ON COLUMN stock_disposal_items.unit_cost IS 'Most recent received purchase-order unit cost at time of disposal (0 if never purchased via a PO)';
COMMENT ON COLUMN stock_disposal_items.value_lost IS 'qty * unit_cost, estimated inventory value written off';
