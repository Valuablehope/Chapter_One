-- Migration 012: Add unit_of_measure to products
-- Adds a unit of measure column to the products table.
-- Default value is 'each' to ensure backward compatibility with existing products.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'each';
