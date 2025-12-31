-- =====================================================
-- Database Indexes for Performance Optimization
-- This script creates indexes on frequently queried columns
-- Run this script after your database schema is set up
-- =====================================================

-- =====================================================
-- Required Extensions
-- =====================================================
-- Create pg_trgm extension for full-text search indexes
-- This improves ILIKE search performance significantly
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- Products Table Indexes
-- =====================================================

-- Index for barcode lookups (unique constraint should already create an index, but ensuring it exists)
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- Index for SKU lookups
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;

-- Index for product type filtering
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);

-- Index for inventory tracking filter
CREATE INDEX IF NOT EXISTS idx_products_track_inventory ON products(track_inventory);

-- Index for created_at ordering (used in pagination)
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Composite index for common search patterns (name, sku, barcode)
-- Trigram index for improved ILIKE search performance on product names
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- =====================================================
-- Customers Table Indexes
-- =====================================================

-- Index for full_name search (ILIKE with %)
-- Trigram indexes require pg_trgm extension - commented out by default
-- To enable: 
--   1. Run: CREATE EXTENSION IF NOT EXISTS pg_trgm;
--   2. Uncomment the line below:
-- CREATE INDEX IF NOT EXISTS idx_customers_full_name_trgm ON customers USING gin(full_name gin_trgm_ops) WHERE full_name IS NOT NULL;

-- Index for phone search
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;

-- Index for email search
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email IS NOT NULL;

-- Index for created_at ordering
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- =====================================================
-- Suppliers Table Indexes
-- =====================================================

-- Index for supplier name search
-- Trigram indexes require pg_trgm extension - commented out by default
-- To enable: 
--   1. Run: CREATE EXTENSION IF NOT EXISTS pg_trgm;
--   2. Uncomment the line below:
-- CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm ON suppliers USING gin(name gin_trgm_ops) WHERE name IS NOT NULL;

-- Index for created_at ordering
CREATE INDEX IF NOT EXISTS idx_suppliers_created_at ON suppliers(created_at DESC);

-- =====================================================
-- Sales Table Indexes
-- =====================================================

-- Index for store_id filtering (very common)
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON sales(store_id);

-- Index for customer_id joins
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id) WHERE customer_id IS NOT NULL;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);

-- Index for date-based queries (used in reports and receipt number generation)
-- Note: Instead of indexing on date cast (which can cause immutability issues),
-- we use the timestamp index below which efficiently handles date-based queries
-- PostgreSQL can use timestamp indexes for DATE() comparisons in WHERE clauses
-- CREATE INDEX IF NOT EXISTS idx_sales_created_at_date ON sales((created_at::date));

-- Composite index for store + date queries (common pattern)
-- Using timestamp instead of date cast for better compatibility and performance
CREATE INDEX IF NOT EXISTS idx_sales_store_created_at ON sales(store_id, created_at);

-- Index for created_at ordering
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);

-- Index for client_sale_id (duplicate detection for offline sync)
CREATE INDEX IF NOT EXISTS idx_sales_client_sale_id ON sales(client_sale_id) 
WHERE client_sale_id IS NOT NULL;

-- =====================================================
-- Sale Items Table Indexes
-- =====================================================

-- Index for sale_id joins (very common)
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);

-- Index for product_id lookups
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- =====================================================
-- Purchase Orders Table Indexes
-- =====================================================

-- Index for store_id filtering
CREATE INDEX IF NOT EXISTS idx_purchase_orders_store_id ON purchase_orders(store_id);

-- Index for supplier_id joins
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);

-- Index for ordered_at ordering (used in pagination)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_ordered_at ON purchase_orders(ordered_at DESC);

-- Index for date-based queries (receipt number generation)
-- Note: Instead of indexing on date cast (which can cause immutability issues),
-- we use the timestamp index below which efficiently handles date-based queries
-- PostgreSQL can use timestamp indexes for DATE() comparisons in WHERE clauses
-- CREATE INDEX IF NOT EXISTS idx_purchase_orders_ordered_at_date ON purchase_orders((ordered_at::date));

-- Composite index for store + date queries
-- Using timestamp instead of date cast for better compatibility and performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_store_ordered_at ON purchase_orders(store_id, ordered_at);

-- =====================================================
-- Purchase Order Items Table Indexes
-- =====================================================

-- Index for po_id joins (very common, especially after N+1 fix)
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON purchase_order_items(po_id);

-- Index for product_id lookups
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_id ON purchase_order_items(product_id);

-- =====================================================
-- Users Table Indexes
-- =====================================================

-- Index for username lookups (case-insensitive login)
-- Note: LOWER() is immutable in PostgreSQL, but if you get an error, you may need to:
-- 1. Ensure you're using PostgreSQL 9.1+ 
-- 2. Check if there's a custom LOWER function that's not immutable
-- 3. Use the alternative: CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username);
--    and handle case-insensitivity in application code
DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS idx_app_users_username_lower ON app_users(LOWER(username));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create idx_app_users_username_lower: %', SQLERRM;
    -- Fallback: create regular index
    CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username);
END $$;

-- Index for is_active filtering
CREATE INDEX IF NOT EXISTS idx_app_users_is_active ON app_users(is_active);

-- Composite index for active username lookups (common login pattern)
-- Using DO block to handle potential LOWER() immutability issues
DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS idx_app_users_active_username ON app_users(is_active, LOWER(username));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create idx_app_users_active_username: %', SQLERRM;
    -- Fallback: create composite index without LOWER
    CREATE INDEX IF NOT EXISTS idx_app_users_active_username_alt ON app_users(is_active, username);
END $$;

-- =====================================================
-- Licenses Table Indexes
-- =====================================================

-- Index for store_id lookups (very common)
CREATE INDEX IF NOT EXISTS idx_licenses_store_id ON licenses(store_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

-- Index for subscription_type filtering
CREATE INDEX IF NOT EXISTS idx_licenses_subscription_type ON licenses(subscription_type);

-- Index for expiry_date queries (used in license validation)
CREATE INDEX IF NOT EXISTS idx_licenses_expiry_date ON licenses(expiry_date);

-- Composite index for active license lookups
CREATE INDEX IF NOT EXISTS idx_licenses_store_status ON licenses(store_id, status, valid);

-- =====================================================
-- Device Activations Table Indexes
-- =====================================================

-- Index for license_id lookups (very common)
CREATE INDEX IF NOT EXISTS idx_device_activations_license_id ON device_activations(license_id);

-- Index for device_fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_device_activations_device_fingerprint ON device_activations(device_fingerprint);

-- Composite index for active device lookups (common validation pattern)
CREATE INDEX IF NOT EXISTS idx_device_activations_license_fingerprint_active ON device_activations(license_id, device_fingerprint, is_active);

-- =====================================================
-- Stores Table Indexes
-- =====================================================

-- Index for is_active filtering (used in getDefaultStore)
CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores(is_active);

-- Composite index for active stores ordered by created_at
CREATE INDEX IF NOT EXISTS idx_stores_active_created ON stores(is_active, created_at) WHERE is_active = true;

-- =====================================================
-- Terminals Table Indexes
-- =====================================================

-- Index for store_id filtering
CREATE INDEX IF NOT EXISTS idx_terminals_store_id ON terminals(store_id);

-- Index for is_active filtering
CREATE INDEX IF NOT EXISTS idx_terminals_is_active ON terminals(is_active);

-- Composite index for active terminals by store
CREATE INDEX IF NOT EXISTS idx_terminals_store_active_created ON terminals(store_id, is_active, created_at) WHERE is_active = true;

-- =====================================================
-- Stock Movements Table Indexes
-- =====================================================

-- Index for store_id filtering
CREATE INDEX IF NOT EXISTS idx_stock_movements_store_id ON stock_movements(store_id);

-- Index for product_id lookups
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);

-- Index for created_at ordering (movement history)
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);

-- Composite index for product stock history
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created ON stock_movements(product_id, created_at DESC);

-- =====================================================
-- Stock Balances View (if exists)
-- =====================================================
-- Note: Views don't have indexes, but underlying tables should be indexed
-- The stock_balances view likely queries stock_movements, which is indexed above

-- =====================================================
-- Notes
-- =====================================================
-- 1. GIN indexes (gin_trgm_ops) require the pg_trgm extension
--    Run: CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- 2. Functional indexes (LOWER) are used for case-insensitive queries
--    Date-based queries use timestamp indexes instead of date cast indexes for better compatibility
-- 3. Partial indexes (WHERE clause) reduce index size and improve performance
-- 4. Composite indexes are created for common query patterns
-- 5. All indexes use IF NOT EXISTS to allow safe re-running of this script

-- =====================================================
-- Required Extensions
-- =====================================================
-- Uncomment if you need full-text search with trigram indexes:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

