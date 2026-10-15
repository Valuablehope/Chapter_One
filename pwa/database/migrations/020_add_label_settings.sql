-- =====================================================
-- Add Label Customization Settings
-- =====================================================
-- Adds toggles and font size customizations for the 
-- shelf label printer. 
-- =====================================================

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS label_show_lbp BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS label_store_name_size NUMERIC(5,2) DEFAULT 5.5,
  ADD COLUMN IF NOT EXISTS label_product_name_size NUMERIC(5,2) DEFAULT 15,
  ADD COLUMN IF NOT EXISTS label_lbp_size NUMERIC(5,2) DEFAULT 20,
  ADD COLUMN IF NOT EXISTS label_price_size NUMERIC(5,2) DEFAULT 30;

COMMENT ON COLUMN store_settings.label_show_lbp
  IS 'Whether to show the LBP secondary price on labels based on the active lbp_exchange_rate';
