-- =====================================================
-- Add round_lbp_to_1000 to store_settings Table
-- =====================================================
-- Adds round_lbp_to_1000 column to round LBP calculated
-- amounts up to the nearest 1000 in POS.
-- =====================================================

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS round_lbp_to_1000 BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN store_settings.round_lbp_to_1000
  IS 'If true, rounds LBP calculated amounts up to the nearest 1000.';
