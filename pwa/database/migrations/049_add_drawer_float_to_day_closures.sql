-- Carry-forward drawer float: lets a closure record how much cash is left in the
-- drawer for the next day (opening float), and how much that opening float was
-- on this closure (carried from the previous one).
ALTER TABLE day_closures
  ADD COLUMN IF NOT EXISTS opening_float NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_float_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS cash_left_in_drawer NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_left_in_drawer_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS cash_to_bank NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN day_closures.opening_float IS 'Cash float carried in from the previous closure''s cash_left_in_drawer';
COMMENT ON COLUMN day_closures.opening_float_breakdown IS 'Notes and coins breakdown of the opening float';
COMMENT ON COLUMN day_closures.cash_left_in_drawer IS 'Amount of counted cash kept in the drawer for the next closure''s opening float';
COMMENT ON COLUMN day_closures.cash_left_in_drawer_breakdown IS 'Notes and coins breakdown of the cash left in the drawer';
COMMENT ON COLUMN day_closures.cash_to_bank IS 'Amount of counted cash to deposit/bank = cash_actual - cash_left_in_drawer';
