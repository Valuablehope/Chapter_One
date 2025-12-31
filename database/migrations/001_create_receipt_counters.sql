-- =====================================================
-- Migration: Create Daily Receipt Counters Table
-- Purpose: Atomic receipt number generation to prevent race conditions
-- =====================================================

-- Create daily_receipt_counters table for atomic receipt number generation
CREATE TABLE IF NOT EXISTS daily_receipt_counters (
  store_id UUID NOT NULL,
  date DATE NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, date),
  FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_receipt_counters_store_date 
ON daily_receipt_counters(store_id, date);

-- Add comment
COMMENT ON TABLE daily_receipt_counters IS 'Atomic counter for daily receipt number generation per store';

