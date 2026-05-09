-- Add label height and free-form canvas element positions to store_settings
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS label_height_mm NUMERIC DEFAULT 40,
  ADD COLUMN IF NOT EXISTS label_canvas_elements JSONB DEFAULT NULL;
