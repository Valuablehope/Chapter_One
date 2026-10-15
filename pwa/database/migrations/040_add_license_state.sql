-- license_state: single row per store, updated via UPSERT on each Convex activation
CREATE TABLE IF NOT EXISTS public.license_state (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL UNIQUE,
    device_id varchar(255),
    installation_id varchar(255),
    plan varchar(50) NOT NULL,
    status varchar(50) NOT NULL DEFAULT 'active',
    valid_from timestamp without time zone NOT NULL,
    valid_until timestamp without time zone NOT NULL,
    last_activated_at timestamp without time zone NOT NULL DEFAULT now(),
    convex_subscription_id varchar(255),
    last_convex_license_id varchar(255),
    last_license_prefix varchar(50),
    customer_name varchar(255),
    customer_email varchar(255),
    company_name varchar(255),
    store_name varchar(255),
    license_payload_hash text,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

-- license_activations: append-only history of every successful activation
CREATE TABLE IF NOT EXISTS public.license_activations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL,
    device_id varchar(255),
    installation_id varchar(255),
    convex_subscription_id varchar(255),
    convex_license_id varchar(255),
    license_prefix varchar(50),
    plan varchar(50) NOT NULL,
    validity_days integer,
    valid_from timestamp without time zone NOT NULL,
    valid_until timestamp without time zone NOT NULL,
    activated_at timestamp without time zone NOT NULL DEFAULT now(),
    activation_result varchar(50) NOT NULL DEFAULT 'success',
    created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_license_state_store_id ON public.license_state (store_id);
CREATE INDEX IF NOT EXISTS idx_license_state_valid_until ON public.license_state (valid_until);
CREATE INDEX IF NOT EXISTS idx_license_activations_store_id ON public.license_activations (store_id);
CREATE INDEX IF NOT EXISTS idx_license_activations_activated_at ON public.license_activations (activated_at DESC);

-- Ensure licenses.store_id is unique so LicenseStateModel can upsert into it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'licenses_store_id_unique'
      AND conrelid = 'public.licenses'::regclass
  ) THEN
    ALTER TABLE public.licenses ADD CONSTRAINT licenses_store_id_unique UNIQUE (store_id);
  END IF;
END;
$$;
