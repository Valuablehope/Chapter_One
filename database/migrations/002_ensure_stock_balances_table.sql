-- =====================================================
-- Migration: Ensure stock_balances is a Real Table
-- Purpose: Convert stock_balances from view to table for O(1) queries
-- =====================================================

-- Drop view if it exists (views cannot have indexes)
DROP VIEW IF EXISTS stock_balances CASCADE;

-- Create stock_balances table if it doesn't exist
CREATE TABLE IF NOT EXISTS stock_balances (
  store_id UUID NOT NULL,
  product_id UUID NOT NULL,
  qty_on_hand INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, product_id),
  FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stock_balances_store_product 
ON stock_balances(store_id, product_id);

-- Create index for updated_at (for auditing)
CREATE INDEX IF NOT EXISTS idx_stock_balances_updated_at 
ON stock_balances(updated_at DESC);

-- Add comment
COMMENT ON TABLE stock_balances IS 'Real-time stock balances maintained by application (not a view)';

-- One-time: Calculate initial balances from existing stock movements
-- This backfills data for existing installations
INSERT INTO stock_balances (store_id, product_id, qty_on_hand)
SELECT 
  store_id, 
  product_id, 
  SUM(qty) as qty_on_hand
FROM stock_movements
GROUP BY store_id, product_id
ON CONFLICT (store_id, product_id) DO NOTHING;

