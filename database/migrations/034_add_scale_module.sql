-- Migration 034: Digital scale (label-printing scale) integration module
--
-- Adds:
--   1. products.plu_code — the numeric PLU programmed into the scale for a product.
--   2. scale_devices — LAN-connected label scales (any brand) with a pluggable sync driver.
--   3. scale_barcode_formats — configurable price/weight-embedded barcode layouts so the
--      POS can decode labels printed by ANY scale model at scan time.

-- 1. PLU code on products (the code embedded in scale label barcodes)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS plu_code BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_plu_code
  ON products (plu_code)
  WHERE plu_code IS NOT NULL;

-- 2. Registered scale devices
CREATE TABLE IF NOT EXISTS scale_devices (
    scale_id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    name              TEXT        NOT NULL,
    brand             TEXT        NOT NULL DEFAULT 'generic',      -- preset key (digi, cas, aclas, rongta, mettler_toledo, bizerba, generic, ...)
    driver            TEXT        NOT NULL DEFAULT 'generic_tcp',  -- generic_tcp | csv_export
    host              TEXT,                                        -- IP / hostname for LAN drivers
    port              INTEGER,
    department        INTEGER,                                     -- optional: only sync PLUs of this department
    options           JSONB       NOT NULL DEFAULT '{}',           -- driver-specific settings (record template, encoding, price multiplier, ...)
    is_active         BOOLEAN     NOT NULL DEFAULT true,
    last_sync_at      TIMESTAMPTZ,
    last_sync_status  TEXT,                                        -- success | error
    last_sync_message TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Barcode layouts printed by the scales (universal decoding config)
CREATE TABLE IF NOT EXISTS scale_barcode_formats (
    format_id     UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    name          TEXT          NOT NULL,
    prefixes      TEXT          NOT NULL DEFAULT '20,21,22,23,24,25,26,27,28,29', -- comma-separated accepted prefixes (must share one length)
    plu_length    INTEGER       NOT NULL DEFAULT 5 CHECK (plu_length BETWEEN 1 AND 10),
    value_length  INTEGER       NOT NULL DEFAULT 5 CHECK (value_length BETWEEN 0 AND 10),
    value_type    TEXT          NOT NULL DEFAULT 'price' CHECK (value_type IN ('price', 'weight', 'quantity', 'none')),
    value_divisor NUMERIC(12,4) NOT NULL DEFAULT 100 CHECK (value_divisor > 0),   -- 100 = 2 implied decimals, 1000 = grams→kg
    check_digit   TEXT          NOT NULL DEFAULT 'ean13' CHECK (check_digit IN ('none', 'ean13')),
    is_active     BOOLEAN       NOT NULL DEFAULT true,
    priority      INTEGER       NOT NULL DEFAULT 0,                               -- lower number wins when several formats match
    created_at    TIMESTAMPTZ   DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- Seed the two industry-standard EAN-13 in-store layouts (prefixes 20–29 are
-- reserved for in-store use, so these are safe defaults for any scale brand).
-- Exact product-barcode matches always take precedence over these at scan time.
INSERT INTO scale_barcode_formats (name, prefixes, plu_length, value_length, value_type, value_divisor, check_digit, is_active, priority)
SELECT 'EAN-13 price-embedded (2X PPPPP €€€€€ C)', '20,21,22,23,24,25,26,27,28,29', 5, 5, 'price', 100, 'ean13', true, 10
WHERE NOT EXISTS (SELECT 1 FROM scale_barcode_formats);

INSERT INTO scale_barcode_formats (name, prefixes, plu_length, value_length, value_type, value_divisor, check_digit, is_active, priority)
SELECT 'EAN-13 weight-embedded (2X PPPPP GGGGG C)', '20,21,22,23,24,25,26,27,28,29', 5, 5, 'weight', 1000, 'ean13', false, 20
WHERE NOT EXISTS (SELECT 1 FROM scale_barcode_formats WHERE value_type = 'weight');
