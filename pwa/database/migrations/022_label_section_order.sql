-- Order of shelf label blocks: JSON array of section ids, e.g. ["header","title","lbp","price"]

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS label_section_order JSONB DEFAULT '["header","title","lbp","price"]'::jsonb;

COMMENT ON COLUMN store_settings.label_section_order IS 'Display order of label sections: header, title, lbp, price';
