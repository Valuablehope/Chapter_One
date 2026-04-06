-- Day closure (Z report): links paid sales to a closure record; locked sales cannot be edited.
CREATE TABLE IF NOT EXISTS day_closures (
  id SERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(store_id) ON DELETE RESTRICT,
  closure_date DATE NOT NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
  total_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  cash_expected NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cash_actual NUMERIC(12, 2),
  cash_difference NUMERIC(12, 2),
  card_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  other_payments NUMERIC(12, 2) NOT NULL DEFAULT 0,
  closed_by UUID NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  z_number INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, z_number)
);

CREATE INDEX IF NOT EXISTS idx_day_closures_store_closed_at ON day_closures(store_id, closed_at DESC);

ALTER TABLE sales ADD COLUMN IF NOT EXISTS day_closure_id INTEGER REFERENCES day_closures(id);

CREATE INDEX IF NOT EXISTS idx_sales_store_open_closure ON sales(store_id, day_closure_id)
  WHERE day_closure_id IS NULL AND status = 'paid';

COMMENT ON COLUMN sales.day_closure_id IS 'Set when sale is included in a day closure (Z); non-null sales are immutable.';
