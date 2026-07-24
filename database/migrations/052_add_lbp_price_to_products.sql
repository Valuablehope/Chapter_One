-- Migration 052: Persist the exact LBP price entered on a product
-- Previously the LBP price shown in the product form was always re-derived
-- from sale_price * lbp_exchange_rate, which drifts on round-trip (e.g. an
-- entered 300000 LBP becomes ~299825 after converting to USD cents and back).
-- Storing the value the user actually typed avoids that drift entirely.

ALTER TABLE products ADD COLUMN IF NOT EXISTS lbp_price NUMERIC(18,2);
