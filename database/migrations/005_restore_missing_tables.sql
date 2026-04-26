-- Migration 005: Restore missing tables from dump
-- This file restores tables that were present in previous versions but missing from the current base schema.

-- 1. Bookstore Tables
CREATE TABLE IF NOT EXISTS authors (
    author_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS publishers (
    publisher_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
    book_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    isbn13 TEXT,
    title TEXT NOT NULL,
    subtitle TEXT,
    publisher_id UUID REFERENCES publishers(publisher_id) ON DELETE SET NULL,
    publish_year INTEGER,
    edition TEXT,
    language TEXT,
    list_price NUMERIC(12,2) DEFAULT 0 NOT NULL,
    sale_price NUMERIC(12,2),
    tax_rate NUMERIC(5,2) DEFAULT 0 NOT NULL,
    barcode TEXT,
    sku TEXT,
    track_inventory BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS book_authors (
    book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES authors(author_id) ON DELETE CASCADE,
    ord INTEGER DEFAULT 1 NOT NULL,
    PRIMARY KEY (book_id, author_id)
);

CREATE TABLE IF NOT EXISTS book_categories (
    book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, category_id)
);

CREATE TABLE IF NOT EXISTS product_books (
    product_id UUID PRIMARY KEY REFERENCES products(product_id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(book_id) ON DELETE SET NULL,
    isbn13 TEXT,
    subtitle TEXT,
    publisher_id UUID REFERENCES publishers(publisher_id) ON DELETE SET NULL,
    publish_year INTEGER,
    edition TEXT,
    language TEXT
);

-- 2. Suppliers & Purchase Orders
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id),
    store_id UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    po_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'PENDING', 'RECEIVED', 'CANCELLED')),
    ordered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expected_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    ordered_date DATE GENERATED ALWAYS AS (((ordered_at AT TIME ZONE 'UTC'::text))::date) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    po_item_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id UUID NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(product_id),
    qty_ordered INTEGER NOT NULL CHECK (qty_ordered > 0),
    qty_received INTEGER DEFAULT 0 NOT NULL CHECK (qty_received >= 0),
    unit_cost NUMERIC(12,2) DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Licensing System
CREATE TABLE IF NOT EXISTS licenses (
    license_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    license_key TEXT,
    valid BOOLEAN DEFAULT false NOT NULL,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    subscription_type VARCHAR(50) DEFAULT 'yearly',
    status VARCHAR(50) DEFAULT 'active',
    start_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE DEFAULT (CURRENT_DATE + interval '1 year'),
    max_devices INTEGER DEFAULT 1,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS device_activations (
    activation_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    license_id UUID REFERENCES licenses(license_id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_info JSONB,
    is_active BOOLEAN DEFAULT true,
    activated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_validated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS license_validations (
    validation_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES stores(store_id) ON DELETE CASCADE,
    license_id UUID REFERENCES licenses(license_id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255),
    validation_result VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. System & Support Tables
CREATE TABLE IF NOT EXISTS system_logs (
    log_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    user_id UUID REFERENCES app_users(user_id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS system_backups (
    backup_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    backup_type TEXT NOT NULL CHECK (backup_type IN ('manual', 'scheduled', 'auto')),
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
    file_path TEXT,
    file_size BIGINT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_by UUID REFERENCES app_users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notification_prefs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('stock', 'sales', 'system', 'backup', 'reports')),
    active BOOLEAN DEFAULT true NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('immediate', 'daily', 'weekly')),
    threshold_value NUMERIC(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_settings (
    store_id UUID PRIMARY KEY REFERENCES stores(store_id) ON DELETE CASCADE,
    sales BOOLEAN DEFAULT true NOT NULL,
    inventory BOOLEAN DEFAULT true NOT NULL,
    customers BOOLEAN DEFAULT false NOT NULL,
    performance BOOLEAN DEFAULT true NOT NULL,
    report_frequency TEXT DEFAULT 'weekly' NOT NULL CHECK (report_frequency IN ('daily', 'weekly', 'monthly')),
    retention TEXT DEFAULT '6months' NOT NULL CHECK (retention IN ('3months', '6months', '1year', '2years')),
    auto_reports BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Views
CREATE OR REPLACE VIEW catalog AS
 SELECT p.product_id,
    p.sku,
    p.barcode,
    p.name,
    p.product_type,
    p.list_price,
    p.sale_price,
    p.tax_rate,
    p.track_inventory,
    pb.book_id,
    pb.isbn13,
    pb.subtitle,
    pb.publisher_id,
    pb.publish_year,
    pb.edition,
    pb.language
   FROM products p
     LEFT JOIN product_books pb ON pb.product_id = p.product_id;

-- 6. Essential Triggers (for updated_at)
CREATE TRIGGER trg_books_updated_at 
BEFORE UPDATE ON books 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_suppliers_updated_at 
BEFORE UPDATE ON suppliers 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_purchase_orders_updated_at 
BEFORE UPDATE ON purchase_orders 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_licenses_updated_at 
BEFORE UPDATE ON licenses 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_notification_prefs_updated_at 
BEFORE UPDATE ON notification_prefs 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_analytics_settings_updated_at 
BEFORE UPDATE ON analytics_settings 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
