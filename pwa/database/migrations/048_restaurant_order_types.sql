-- Restaurant order types: dine-in (tables), takeaway (walk-in) and delivery orders.
-- Additive and idempotent. Table/guest columns become nullable because
-- takeaway/delivery orders have no table.

ALTER TABLE public.restaurant_table_sessions
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'dine_in',
  ADD COLUMN IF NOT EXISTS customer_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT NULL;

ALTER TABLE public.restaurant_table_sessions ALTER COLUMN table_number DROP NOT NULL;
ALTER TABLE public.restaurant_table_sessions ALTER COLUMN guest_count DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_sessions_order_type_check'
  ) THEN
    ALTER TABLE public.restaurant_table_sessions
      ADD CONSTRAINT restaurant_sessions_order_type_check
      CHECK (order_type IN ('dine_in', 'takeaway', 'delivery'));
  END IF;
END $$;

-- Dine-in sessions must reference a table; takeaway/delivery must not.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_sessions_table_by_type_check'
  ) THEN
    ALTER TABLE public.restaurant_table_sessions
      ADD CONSTRAINT restaurant_sessions_table_by_type_check
      CHECK (
        (order_type = 'dine_in' AND table_number IS NOT NULL)
        OR (order_type <> 'dine_in')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.restaurant_table_sessions.order_type IS 'dine_in (table), takeaway (walk-in) or delivery';
COMMENT ON COLUMN public.restaurant_table_sessions.customer_name IS 'Walk-in/delivery customer name (optional for walk-in)';
COMMENT ON COLUMN public.restaurant_table_sessions.customer_phone IS 'Delivery customer phone';
COMMENT ON COLUMN public.restaurant_table_sessions.delivery_address IS 'Delivery address';

CREATE INDEX IF NOT EXISTS idx_restaurant_sessions_order_type
  ON public.restaurant_table_sessions (order_type, created_at DESC);
