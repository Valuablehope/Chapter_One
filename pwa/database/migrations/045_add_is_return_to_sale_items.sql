-- Add is_return flag to sale_items so return transactions can be tracked
-- qty stays positive; is_return=true indicates the item is being returned (stock restored)
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS is_return BOOLEAN NOT NULL DEFAULT FALSE;
