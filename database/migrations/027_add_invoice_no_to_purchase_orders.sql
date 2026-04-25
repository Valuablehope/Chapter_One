-- Add invoice_no column to purchase_orders table
ALTER TABLE purchase_orders ADD COLUMN invoice_no VARCHAR(255);
