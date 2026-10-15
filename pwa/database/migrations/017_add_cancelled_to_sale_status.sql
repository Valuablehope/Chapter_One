-- Add 'cancelled' value to the sale_status enum type
-- This allows sales invoices to be cancelled by admin users

DO $$
BEGIN
  -- Only add the value if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'sale_status'
    AND e.enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE sale_status ADD VALUE 'cancelled';
  END IF;
END$$;
