-- ─────────────────────────────────────────────────────────────────────────────
-- Expense categories
-- store_id NULL  = system-wide (pre-seeded, not deletable)
-- store_id set   = custom category for that store (admin-managed)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_categories (
  category_id SERIAL PRIMARY KEY,
  store_id    UUID         REFERENCES stores(store_id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  is_system   BOOLEAN      NOT NULL DEFAULT false,
  sort_order  INTEGER      NOT NULL DEFAULT 100,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Partial unique index: one name per store (NULL store_id = global)
CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_cat_global_name
  ON expense_categories (name) WHERE store_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_cat_store_name
  ON expense_categories (store_id, name) WHERE store_id IS NOT NULL;

-- Pre-seed system categories
INSERT INTO expense_categories (name, is_system, sort_order) VALUES
  ('Rent',                 true,  1),
  ('Electricity',          true,  2),
  ('Internet',             true,  3),
  ('Cleaning',             true,  4),
  ('Maintenance',          true,  5),
  ('Fuel',                 true,  6),
  ('Staff Meals',          true,  7),
  ('Packaging',            true,  8),
  ('Delivery Costs',       true,  9),
  ('Supplier Fees',        true, 10),
  ('Cash Drawer Shortage', true, 11),
  ('Miscellaneous',        true, 12)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Individual expense records
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  expense_id     UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id       UUID         NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
  category_id    INTEGER      NOT NULL REFERENCES expense_categories(category_id),
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description    TEXT,
  expense_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
  day_closure_id INTEGER      REFERENCES day_closures(id) ON DELETE SET NULL,
  created_by     UUID         REFERENCES app_users(user_id),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_store_date
  ON expenses(store_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_unclosed
  ON expenses(store_id, day_closure_id) WHERE day_closure_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_expense_categories_store
  ON expense_categories(store_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Track total expenses per closure in day_closures
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE day_closures
  ADD COLUMN IF NOT EXISTS total_expenses NUMERIC(12,2) NOT NULL DEFAULT 0;
