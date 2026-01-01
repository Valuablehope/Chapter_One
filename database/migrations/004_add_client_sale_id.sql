-- Migration: Add client_sale_id column for offline conflict resolution
-- This allows detection of duplicate sales from offline sync

-- Add client_sale_id column to sales table
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS client_sale_id VARCHAR(255);

-- Create unique index on client_sale_id to prevent duplicates
-- Only enforce uniqueness for non-null values
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_client_sale_id 
ON sales(client_sale_id) 
WHERE client_sale_id IS NOT NULL;



