-- Add 'cancelled' value to the movement_reason enum type
-- This allows stock reversals to be recorded when a sale invoice is cancelled

DO $$
BEGIN
  -- Only add the value if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'movement_reason'
    AND e.enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE movement_reason ADD VALUE 'cancelled';
  END IF;
END$$;
