-- =====================================================
-- Migration: Base Schema Initialization
-- Purpose: Create initial database structure for fresh installs
-- =====================================================

-- 1. Custom Types
CREATE TYPE movement_reason AS ENUM (
    'purchase', 'sale', 'return_in', 'return_out', 'adjustment_pos', 
    'adjustment_neg', 'transfer_in', 'transfer_out', 'damage', 'theft', 
    'adjustment', 'return'
);

CREATE TYPE payment_method AS ENUM ('cash', 'card', 'voucher', 'mixed', 'other');

CREATE TYPE sale_status AS ENUM ('open', 'paid', 'void', 'refunded');

-- 2. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 3. Core Tables
CREATE TABLE IF NOT EXISTS stores (
    store_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    timezone TEXT DEFAULT 'Asia/Beirut' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS store_settings (
    store_id UUID PRIMARY KEY REFERENCES stores(store_id) ON DELETE CASCADE,
    currency_code TEXT DEFAULT 'USD' NOT NULL,
    tax_inclusive BOOLEAN DEFAULT false NOT NULL,
    low_stock_threshold INTEGER DEFAULT 3 NOT NULL,
    theme TEXT DEFAULT 'quantum' NOT NULL,
    tax_rate NUMERIC(5,2) DEFAULT 0.00,
    receipt_footer TEXT,
    receipt_header TEXT,
    auto_backup BOOLEAN DEFAULT false,
    backup_frequency TEXT DEFAULT 'daily',
    show_stock BOOLEAN DEFAULT true,
    auto_add_qty BOOLEAN DEFAULT true,
    allow_negative BOOLEAN DEFAULT false,
    paper_size VARCHAR(50) DEFAULT '80mm',
    auto_print BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS app_users (
    user_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('cashier', 'manager', 'admin')),
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    product_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sku TEXT UNIQUE,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    product_type TEXT DEFAULT 'BOOK',
    list_price NUMERIC(12,2) DEFAULT 0,
    sale_price NUMERIC(12,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    track_inventory BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    category_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES categories(category_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    total_orders INTEGER DEFAULT 0,
    total_spent NUMERIC(10,2) DEFAULT 0.00,
    last_order TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS terminals (
    terminal_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(store_id, code)
);

CREATE TABLE IF NOT EXISTS sales (
    sale_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(store_id),
    terminal_id UUID NOT NULL REFERENCES terminals(terminal_id),
    cashier_id UUID NOT NULL REFERENCES app_users(user_id),
    customer_id UUID REFERENCES customers(customer_id),
    receipt_no TEXT NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    tax_total NUMERIC(12,2) NOT NULL,
    discount_total NUMERIC(12,2) DEFAULT 0 NOT NULL,
    grand_total NUMERIC(12,2) NOT NULL,
    paid_total NUMERIC(12,2) NOT NULL,
    status sale_status DEFAULT 'paid' NOT NULL,
    client_sale_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
    sale_item_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sales(sale_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(product_id),
    qty INTEGER NOT NULL CHECK (qty > 0),
    unit_price NUMERIC(12,2) NOT NULL,
    tax_rate NUMERIC(5,2) NOT NULL,
    line_total NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_payments (
    sale_payment_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sales(sale_id) ON DELETE CASCADE,
    method payment_method NOT NULL,
    amount NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
    movement_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    reason movement_reason NOT NULL,
    qty INTEGER NOT NULL,
    reference TEXT,
    created_by UUID REFERENCES app_users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Essential Functions & Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at 
BEFORE UPDATE ON products 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_customers_updated_at 
BEFORE UPDATE ON customers 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
