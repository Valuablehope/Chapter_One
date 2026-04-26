-- Add cash_breakdown column to day_closures table for audit purposes
ALTER TABLE day_closures ADD COLUMN cash_breakdown JSONB;

COMMENT ON COLUMN day_closures.cash_breakdown IS 'Breakdown of notes and coins counted during closure';
