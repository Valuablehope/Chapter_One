-- =====================================================
-- Add LBP Exchange Rate to store_settings Table
-- =====================================================
-- Adds lbp_exchange_rate column so administrators can
-- enter how many Lebanese Pounds (LBP) equal 1 unit of
-- the store's primary currency.
-- NULL or 0  => LBP conversion is hidden in POS.
-- =====================================================

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS lbp_exchange_rate NUMERIC(18, 4) DEFAULT NULL;

COMMENT ON COLUMN store_settings.lbp_exchange_rate
  IS 'Exchange rate: how many LBP equal 1 unit of the store primary currency. NULL = disabled.';
