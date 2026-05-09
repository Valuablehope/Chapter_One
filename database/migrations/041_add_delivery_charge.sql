-- Migration 038: Add delivery charge to sales and store settings
-- delivery_charge is stored per-sale; grand_total includes it.
-- include_delivery_in_drawer controls whether day-closure revenues count it.

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS include_delivery_in_drawer BOOLEAN NOT NULL DEFAULT TRUE;
