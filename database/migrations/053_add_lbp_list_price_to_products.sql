-- Migration 053: Persist the exact LBP List Price, mirroring lbp_price (Sale Price).
ALTER TABLE products ADD COLUMN IF NOT EXISTS lbp_list_price NUMERIC(18,2);
