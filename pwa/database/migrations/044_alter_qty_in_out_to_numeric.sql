-- Alter qty_in and qty_out tracking columns in stock_balances to support decimal weights
ALTER TABLE stock_balances 
  ALTER COLUMN qty_in TYPE NUMERIC(10,3) USING qty_in::numeric,
  ALTER COLUMN qty_out TYPE NUMERIC(10,3) USING qty_out::numeric;

-- Alter qty column in opening_stock_items to support decimal weights
ALTER TABLE opening_stock_items
  ALTER COLUMN qty TYPE NUMERIC(10,3) USING qty::numeric;
