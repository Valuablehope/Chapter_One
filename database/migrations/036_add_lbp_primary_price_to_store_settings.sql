-- =====================================================
-- Add lbp_primary_price to store_settings Table
-- =====================================================
-- When enabled alongside show_lbp_price, the LBP amount
-- is displayed as the primary (larger) price in POS Sales
-- and the USD amount is shown as the secondary (smaller) price.
-- =====================================================

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS lbp_primary_price BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN store_settings.lbp_primary_price
  IS 'If true, LBP is shown as the primary price in POS Sales cart (requires show_lbp_price = true).';
