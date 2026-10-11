-- Self-heal schema drift on purchase orders / receiving.
--
-- Some client databases (legacy installs, or ones where an older migration was skipped or
-- failed) are missing columns/triggers that Edit and Receive rely on. Creating a PO only
-- INSERTs, so it keeps working, while Edit/Receive run UPDATEs against purchase_orders (which
-- fire the updated_at trigger) and write numeric quantities — and fail with a generic 500.
--
-- Everything here is idempotent and each repair is isolated so that one failure can never
-- block startup of the app.

-- Shared trigger function (the trigger below needs it to exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- purchase_orders: columns the model reads/writes, plus the updated_at trigger that needs them
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS invoice_no   VARCHAR(255);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_at  TIMESTAMP WITH TIME ZONE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;

DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER trg_purchase_orders_updated_at
BEFORE UPDATE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- purchase_order_items: bookkeeping columns
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;

-- stock_balances: qty_in / qty_out are written on every receive
ALTER TABLE stock_balances ADD COLUMN IF NOT EXISTS qty_in  NUMERIC(10,3) NOT NULL DEFAULT 0;
ALTER TABLE stock_balances ADD COLUMN IF NOT EXISTS qty_out NUMERIC(10,3) NOT NULL DEFAULT 0;

-- Quantity columns must be NUMERIC (decimal weights); older DBs may still have INTEGER.
-- Each ALTER is isolated: if a dependent view blocks it we warn instead of aborting.
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'integer'
          AND (table_name, column_name) IN (
              ('purchase_order_items', 'qty_ordered'),
              ('purchase_order_items', 'qty_received'),
              ('stock_balances',       'qty_in'),
              ('stock_balances',       'qty_out'),
              ('stock_balances',       'qty_on_hand'),
              ('stock_movements',      'qty')
          )
    LOOP
        BEGIN
            EXECUTE format(
                'ALTER TABLE %I ALTER COLUMN %I TYPE NUMERIC(10,3) USING %I::numeric',
                col.table_name, col.column_name, col.column_name
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not convert %.% to NUMERIC: %', col.table_name, col.column_name, SQLERRM;
        END;
    END LOOP;
END $$;
