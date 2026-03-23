-- Normalized restaurant context for persisted restaurant checkouts.
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.restaurant_table_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(store_id) ON DELETE CASCADE,
  terminal_id UUID NOT NULL REFERENCES public.terminals(terminal_id) ON DELETE RESTRICT,
  cashier_id UUID NOT NULL REFERENCES public.app_users(user_id) ON DELETE RESTRICT,
  table_number INTEGER NOT NULL CHECK (table_number > 0),
  guest_count INTEGER NOT NULL CHECK (guest_count > 0),
  waiter_name TEXT NULL,
  seated_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'closed' CHECK (status IN ('open', 'closed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restaurant_sale_context (
  sale_id UUID PRIMARY KEY REFERENCES public.sales(sale_id) ON DELETE CASCADE,
  session_id UUID NULL REFERENCES public.restaurant_table_sessions(session_id) ON DELETE SET NULL,
  service_fee_enabled BOOLEAN NOT NULL DEFAULT false,
  service_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  service_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_before_service NUMERIC(12,2) NOT NULL DEFAULT 0,
  checkout_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_sessions_store_created
  ON public.restaurant_table_sessions (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_sessions_table_status
  ON public.restaurant_table_sessions (table_number, status, closed_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_sale_context_checkout_at
  ON public.restaurant_sale_context (checkout_at DESC);
