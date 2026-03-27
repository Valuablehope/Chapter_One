-- Change quantity columns from INT to NUMERIC(10,3) to support decimals (weights)

-- Drop dependent views
DROP VIEW IF EXISTS inventory_list CASCADE;
DROP VIEW IF EXISTS product_stock_balances CASCADE;

ALTER TABLE sale_items ALTER COLUMN qty TYPE NUMERIC(10,3) USING qty::numeric;
ALTER TABLE stock_balances ALTER COLUMN qty_on_hand TYPE NUMERIC(10,3) USING qty_on_hand::numeric;
ALTER TABLE stock_movements ALTER COLUMN qty TYPE NUMERIC(10,3) USING qty::numeric;
ALTER TABLE purchase_order_items ALTER COLUMN qty_ordered TYPE NUMERIC(10,3) USING qty_ordered::numeric;
ALTER TABLE purchase_order_items ALTER COLUMN qty_received TYPE NUMERIC(10,3) USING qty_received::numeric;

-- Recreate product_stock_balances
CREATE OR REPLACE VIEW product_stock_balances AS
 SELECT store_id,
    product_id,
    sum(qty)::numeric(18,2) AS qty_on_hand
   FROM stock_movements sm
  GROUP BY store_id, product_id;

-- Recreate inventory_list
CREATE OR REPLACE VIEW inventory_list AS
 SELECT p.product_id,
    p.name,
    p.sku,
    p.barcode,
    p.product_type,
    sb.store_id,
    COALESCE(sb.qty_on_hand::numeric, 0::numeric) AS qty_on_hand
   FROM products p
     LEFT JOIN stock_balances sb ON sb.product_id = p.product_id;
