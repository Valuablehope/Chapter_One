-- Persist the exact LBP amounts computed at checkout time, instead of always
-- re-deriving LBP from the USD total via the (possibly since-changed) exchange
-- rate on reprint. sale_items.lbp_price snapshots the product's exact LBP unit
-- price at time of sale; sales.grand_total_lbp is the blended exact/converted
-- total shown to the cashier during checkout.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS grand_total_lbp NUMERIC(18,2);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS lbp_price NUMERIC(18,2);
