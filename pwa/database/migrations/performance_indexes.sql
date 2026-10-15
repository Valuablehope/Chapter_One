-- =====================================================
-- REAL FIXED VERSION (PRODUCTION SAFE)
-- =====================================================

-- Sales
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS created_date DATE 
GENERATED ALWAYS AS ((created_at AT TIME ZONE 'UTC')::date) STORED;

CREATE INDEX IF NOT EXISTS idx_sales_created_date 
ON sales(created_date);

-- Purchase Orders
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS ordered_date DATE 
GENERATED ALWAYS AS ((ordered_at AT TIME ZONE 'UTC')::date) STORED;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_ordered_date 
ON purchase_orders(ordered_date);

-- Revenue aggregation
CREATE INDEX IF NOT EXISTS idx_sale_items_line_total 
ON sale_items(line_total);
