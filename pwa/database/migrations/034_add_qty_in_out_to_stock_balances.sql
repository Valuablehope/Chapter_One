-- Add qty_in and qty_out tracking columns to stock_balances
ALTER TABLE stock_balances
  ADD COLUMN IF NOT EXISTS qty_in  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_out INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing stock_movements
UPDATE stock_balances sb
SET
  qty_in  = COALESCE((
    SELECT SUM(qty)
    FROM stock_movements
    WHERE product_id = sb.product_id AND store_id = sb.store_id AND qty > 0
  ), 0),
  qty_out = COALESCE((
    SELECT ABS(SUM(qty))
    FROM stock_movements
    WHERE product_id = sb.product_id AND store_id = sb.store_id AND qty < 0
  ), 0);
