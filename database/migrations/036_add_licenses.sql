DROP TABLE IF EXISTS public.licenses CASCADE;

CREATE TABLE public.licenses (
    license_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Local POS identity
    store_id uuid NOT NULL,
    device_id varchar(255),
    installation_id varchar(255),

    -- Convex returned data
    convex_subscription_id varchar(255),
    convex_license_id varchar(255),
    license_prefix varchar(50),

    -- Plan / subscription info
    plan varchar(50) NOT NULL,
    status varchar(50) NOT NULL DEFAULT 'active',

    -- Local validity enforcement
    valid_from timestamp without time zone NOT NULL,
    valid_until timestamp without time zone NOT NULL,
    activated_at timestamp without time zone NOT NULL DEFAULT now(),

    -- Optional customer/company display info
    customer_name varchar(255),
    customer_email varchar(255),
    company_name varchar(255),
    store_name varchar(255),

    -- Basic local anti-tamper signature/hash
    license_payload_hash text,

    -- Audit
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_licenses_store_id
ON public.licenses (store_id);

CREATE INDEX idx_licenses_status
ON public.licenses (status);

CREATE INDEX idx_licenses_valid_until
ON public.licenses (valid_until);

CREATE INDEX idx_licenses_installation_id
ON public.licenses (installation_id);
