-- Per-section alignment, font weights, and currency/LBP sub-sizes for shelf labels.

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS label_header_align VARCHAR(10) DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS label_header_font_weight SMALLINT DEFAULT 700,
  ADD COLUMN IF NOT EXISTS label_title_align VARCHAR(10) DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS label_title_font_weight SMALLINT DEFAULT 800,
  ADD COLUMN IF NOT EXISTS label_lbp_row_align VARCHAR(10) DEFAULT 'between',
  ADD COLUMN IF NOT EXISTS label_lbp_prefix_size NUMERIC(5,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS label_lbp_prefix_weight SMALLINT DEFAULT 700,
  ADD COLUMN IF NOT EXISTS label_lbp_amount_weight SMALLINT DEFAULT 800,
  ADD COLUMN IF NOT EXISTS label_price_row_align VARCHAR(10) DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS label_currency_size NUMERIC(5,2) DEFAULT 11,
  ADD COLUMN IF NOT EXISTS label_currency_weight SMALLINT DEFAULT 700,
  ADD COLUMN IF NOT EXISTS label_price_amount_weight SMALLINT DEFAULT 900;

COMMENT ON COLUMN store_settings.label_header_align IS 'Store name bar: left | center | right';
COMMENT ON COLUMN store_settings.label_title_align IS 'Product name block: horizontal alignment';
COMMENT ON COLUMN store_settings.label_lbp_row_align IS 'LBP row: between | left | center | right';
COMMENT ON COLUMN store_settings.label_price_row_align IS 'Price band: left | center | right';
