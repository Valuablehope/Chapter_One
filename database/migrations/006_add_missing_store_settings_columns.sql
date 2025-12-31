-- =====================================================
-- Add Missing Columns to store_settings Table
-- =====================================================
-- This migration adds the missing columns that are used
-- in the application but don't exist in the database
-- =====================================================

-- Add missing columns to store_settings table
ALTER TABLE store_settings
ADD COLUMN IF NOT EXISTS show_stock BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_add_qty BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_negative BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS paper_size VARCHAR(50) DEFAULT '80mm',
ADD COLUMN IF NOT EXISTS auto_print BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS receipt_header TEXT;

-- Remove timezone from store_settings (it belongs in stores table)
-- Note: This will fail if timezone column doesn't exist, which is fine
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'store_settings' AND column_name = 'timezone'
    ) THEN
        ALTER TABLE store_settings DROP COLUMN timezone;
        RAISE NOTICE 'Removed timezone column from store_settings (belongs in stores table)';
    ELSE
        RAISE NOTICE 'timezone column does not exist in store_settings, skipping removal';
    END IF;
END $$;

-- Update existing rows with default values for new columns
UPDATE store_settings
SET 
    show_stock = COALESCE(show_stock, true),
    auto_add_qty = COALESCE(auto_add_qty, true),
    allow_negative = COALESCE(allow_negative, false),
    paper_size = COALESCE(paper_size, '80mm'),
    auto_print = COALESCE(auto_print, true)
WHERE show_stock IS NULL 
   OR auto_add_qty IS NULL 
   OR allow_negative IS NULL 
   OR paper_size IS NULL 
   OR auto_print IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN store_settings.show_stock IS 'Whether to show stock levels in POS';
COMMENT ON COLUMN store_settings.auto_add_qty IS 'Automatically add quantity when scanning products';
COMMENT ON COLUMN store_settings.allow_negative IS 'Allow negative stock balances';
COMMENT ON COLUMN store_settings.paper_size IS 'Receipt paper size (e.g., 80mm, A4)';
COMMENT ON COLUMN store_settings.auto_print IS 'Automatically print receipts after sale';
COMMENT ON COLUMN store_settings.receipt_header IS 'Custom header text for receipts';

