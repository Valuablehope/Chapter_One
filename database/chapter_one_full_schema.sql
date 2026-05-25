-- =====================================================================
-- Chapter One POS — Full Database Schema
-- Generated: 2026-05-25
-- PostgreSQL 14+
--
-- Import order:
--   1. Extensions
--   2. Custom ENUM types
--   3. Functions
--   4. Core tables (stores, users, products …)
--   5. Transactional tables (sales, stock …)
--   6. Licensing tables
--   7. Restaurant module tables
--   8. Reporting / support tables
--   9. Views
--  10. Triggers
--  11. Indexes
--  12. Seed data (expense categories)
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ─────────────────────────────────────────────────────────────────────
-- 2. CUSTOM ENUM TYPES
-- ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE movement_reason AS ENUM (
        'purchase', 'sale', 'return_in', 'return_out',
        'adjustment_pos', 'adjustment_neg',
        'transfer_in', 'transfer_out',
        'damage', 'theft', 'adjustment', 'return',
        'cancelled', 'opening_stock'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM (
        'cash', 'card', 'voucher', 'mixed', 'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE sale_status AS ENUM (
        'open', 'paid', 'void', 'refunded', 'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 3. SHARED FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_product_name_tsvector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.name_tsvector := to_tsvector('english', COALESCE(NEW.name, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_restaurant_menus_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- 4. CORE TABLES
-- ─────────────────────────────────────────────────────────────────────

-- Stores
CREATE TABLE IF NOT EXISTS stores (
    store_id  UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    code      TEXT         NOT NULL UNIQUE,
    name      TEXT         NOT NULL,
    address   TEXT,
    phone     TEXT,
    timezone  TEXT         NOT NULL DEFAULT 'Asia/Beirut',
    is_active BOOLEAN      NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store Settings
CREATE TABLE IF NOT EXISTS store_settings (
    store_id                           UUID         PRIMARY KEY REFERENCES stores(store_id) ON DELETE CASCADE,
    -- General
    currency_code                      TEXT         NOT NULL DEFAULT 'USD',
    tax_inclusive                      BOOLEAN      NOT NULL DEFAULT false,
    tax_rate                           NUMERIC(5,2) DEFAULT 0.00,
    low_stock_threshold                INTEGER      NOT NULL DEFAULT 3,
    theme                              TEXT         NOT NULL DEFAULT 'quantum',
    -- Receipt
    receipt_header                     TEXT,
    receipt_footer                     TEXT,
    paper_size                         VARCHAR(50)  DEFAULT '80mm',
    auto_print                         BOOLEAN      DEFAULT true,
    receipt_printer                    VARCHAR(255),
    -- POS Behaviour
    show_stock                         BOOLEAN      DEFAULT true,
    auto_add_qty                       BOOLEAN      DEFAULT true,
    allow_negative                     BOOLEAN      DEFAULT false,
    -- LBP / Currency
    lbp_exchange_rate                  NUMERIC(18,4) DEFAULT NULL,
    show_lbp_price                     BOOLEAN      DEFAULT true,
    lbp_primary_price                  BOOLEAN      DEFAULT false,
    round_lbp_to_1000                  BOOLEAN      DEFAULT false,
    -- Delivery
    include_delivery_in_drawer         BOOLEAN      NOT NULL DEFAULT true,
    -- Payment Methods
    pm_cash                            BOOLEAN      NOT NULL DEFAULT true,
    pm_card                            BOOLEAN      NOT NULL DEFAULT true,
    pm_voucher                         BOOLEAN      NOT NULL DEFAULT true,
    pm_other                           BOOLEAN      NOT NULL DEFAULT true,
    -- Backup
    auto_backup                        BOOLEAN      DEFAULT false,
    backup_frequency                   TEXT         DEFAULT 'daily',
    -- UI
    ui_resolution                      VARCHAR(50)  DEFAULT 'auto',
    heading_size                       VARCHAR(10)  DEFAULT 'md',
    body_size                          VARCHAR(10)  DEFAULT 'md',
    -- POS Module
    pos_module_type                    TEXT         NOT NULL DEFAULT 'store'
                                                    CHECK (pos_module_type IN ('store', 'retail_store', 'restaurant')),
    restaurant_table_count             INTEGER,
    restaurant_track_guests_per_table  BOOLEAN      NOT NULL DEFAULT false,
    restaurant_menus                   JSONB        NOT NULL DEFAULT '[]'::jsonb,
    -- Label Printing
    label_show_lbp                     BOOLEAN      DEFAULT false,
    label_store_name_size              NUMERIC(5,2) DEFAULT 5.5,
    label_product_name_size            NUMERIC(5,2) DEFAULT 15,
    label_lbp_size                     NUMERIC(5,2) DEFAULT 20,
    label_price_size                   NUMERIC(5,2) DEFAULT 30,
    label_header_align                 VARCHAR(10)  DEFAULT 'center',
    label_header_font_weight           SMALLINT     DEFAULT 700,
    label_title_align                  VARCHAR(10)  DEFAULT 'center',
    label_title_font_weight            SMALLINT     DEFAULT 800,
    label_lbp_row_align                VARCHAR(10)  DEFAULT 'between',
    label_lbp_prefix_size              NUMERIC(5,2) DEFAULT 10,
    label_lbp_prefix_weight            SMALLINT     DEFAULT 700,
    label_lbp_amount_weight            SMALLINT     DEFAULT 800,
    label_price_row_align              VARCHAR(10)  DEFAULT 'center',
    label_currency_size                NUMERIC(5,2) DEFAULT 11,
    label_currency_weight              SMALLINT     DEFAULT 700,
    label_price_amount_weight          SMALLINT     DEFAULT 900,
    label_section_order                JSONB        DEFAULT '["header","title","lbp","price"]'::jsonb,
    label_height_mm                    NUMERIC      DEFAULT 40,
    label_canvas_elements              JSONB        DEFAULT NULL,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- App Users
CREATE TABLE IF NOT EXISTS app_users (
    user_id       UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    username      TEXT    NOT NULL UNIQUE,
    full_name     TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK (role IN ('cashier', 'manager', 'admin', 'self_checkout')),
    password_hash TEXT    NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    category_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT NOT NULL,
    parent_id   UUID REFERENCES categories(category_id) ON DELETE SET NULL
);

-- Product Types
CREATE TABLE IF NOT EXISTS product_types (
    id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    name         VARCHAR(100) NOT NULL UNIQUE,
    display_on_pos BOOLEAN    DEFAULT false,
    press_to_add BOOLEAN      DEFAULT false,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    product_id      UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    sku             TEXT          UNIQUE,
    barcode         TEXT          UNIQUE,
    name            TEXT          NOT NULL,
    product_type    TEXT          DEFAULT 'BOOK',
    unit_of_measure VARCHAR(20)   NOT NULL DEFAULT 'each',
    list_price      NUMERIC(12,2) DEFAULT 0,
    sale_price      NUMERIC(12,2) DEFAULT 0,
    tax_rate        NUMERIC(5,2)  DEFAULT 0,
    margin_pct      NUMERIC(10,2),
    track_inventory BOOLEAN       NOT NULL DEFAULT true,
    image_url       TEXT,
    name_tsvector   tsvector,
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    customer_id  UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name    TEXT,
    phone        TEXT,
    email        TEXT,
    notes        TEXT,
    total_orders INTEGER       DEFAULT 0,
    total_spent  NUMERIC(10,2) DEFAULT 0.00,
    last_order   TIMESTAMP,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- Terminals
CREATE TABLE IF NOT EXISTS terminals (
    terminal_id UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id    UUID    NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    code        TEXT    NOT NULL,
    name        TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, code)
);


-- ─────────────────────────────────────────────────────────────────────
-- 5. TRANSACTIONAL TABLES
-- ─────────────────────────────────────────────────────────────────────

-- Day Closures  (referenced by sales, expenses — must precede those)
CREATE TABLE IF NOT EXISTS day_closures (
    id                SERIAL       PRIMARY KEY,
    store_id          UUID         NOT NULL REFERENCES stores(store_id) ON DELETE RESTRICT,
    closure_date      DATE         NOT NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
    total_sales       NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_transactions INTEGER     NOT NULL DEFAULT 0,
    cash_expected     NUMERIC(12,2) NOT NULL DEFAULT 0,
    cash_actual       NUMERIC(12,2),
    cash_difference   NUMERIC(12,2),
    card_total        NUMERIC(12,2) NOT NULL DEFAULT 0,
    other_payments    NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_expenses    NUMERIC(12,2) NOT NULL DEFAULT 0,
    closed_by         UUID         NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
    closed_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    z_number          INTEGER      NOT NULL,
    notes             TEXT,
    cash_breakdown    JSONB,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, z_number)
);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
    sale_id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id         UUID          NOT NULL REFERENCES stores(store_id),
    terminal_id      UUID          NOT NULL REFERENCES terminals(terminal_id),
    cashier_id       UUID          NOT NULL REFERENCES app_users(user_id),
    customer_id      UUID          REFERENCES customers(customer_id),
    receipt_no       TEXT          NOT NULL,
    subtotal         NUMERIC(12,2) NOT NULL,
    tax_total        NUMERIC(12,2) NOT NULL,
    discount_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
    delivery_charge  NUMERIC(10,2) NOT NULL DEFAULT 0,
    grand_total      NUMERIC(12,2) NOT NULL,
    paid_total       NUMERIC(12,2) NOT NULL,
    status           sale_status   NOT NULL DEFAULT 'paid',
    client_sale_id   VARCHAR(255),
    day_closure_id   INTEGER       REFERENCES day_closures(id),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_date     DATE GENERATED ALWAYS AS ((created_at AT TIME ZONE 'UTC')::date) STORED
);

-- Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
    sale_item_id UUID             DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id      UUID             NOT NULL REFERENCES sales(sale_id) ON DELETE CASCADE,
    product_id   UUID             NOT NULL REFERENCES products(product_id),
    qty          NUMERIC(10,3)    NOT NULL CHECK (qty > 0),
    unit_price   NUMERIC(12,2)    NOT NULL,
    tax_rate     NUMERIC(5,2)     NOT NULL,
    line_total   NUMERIC(12,2)    NOT NULL,
    is_return    BOOLEAN          NOT NULL DEFAULT false
);

-- Sale Payments
CREATE TABLE IF NOT EXISTS sale_payments (
    sale_payment_id UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id         UUID          NOT NULL REFERENCES sales(sale_id) ON DELETE CASCADE,
    method          payment_method NOT NULL,
    amount          NUMERIC(12,2) NOT NULL
);

-- Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
    movement_id UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id    UUID            NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    product_id  UUID            NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    reason      movement_reason NOT NULL,
    qty         NUMERIC(10,3)   NOT NULL,
    reference   TEXT,
    created_by  UUID            REFERENCES app_users(user_id),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Stock Balances  (real table, O(1) lookup)
CREATE TABLE IF NOT EXISTS stock_balances (
    store_id    UUID          NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    product_id  UUID          NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    qty_on_hand NUMERIC(10,3) NOT NULL DEFAULT 0,
    qty_in      NUMERIC(10,3) NOT NULL DEFAULT 0,
    qty_out     NUMERIC(10,3) NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    PRIMARY KEY (store_id, product_id)
);

-- Daily Receipt Counters
CREATE TABLE IF NOT EXISTS daily_receipt_counters (
    store_id   UUID    NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    date       DATE    NOT NULL,
    counter    INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (store_id, date)
);

-- Opening Stock Sessions
CREATE TABLE IF NOT EXISTS opening_stock_sessions (
    session_id   UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id     UUID         NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    reference    VARCHAR(100) NOT NULL,
    notes        TEXT,
    status       VARCHAR(20)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'committed')),
    committed_at TIMESTAMPTZ,
    committed_by UUID         REFERENCES app_users(user_id),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by   UUID         REFERENCES app_users(user_id),
    UNIQUE (store_id)
);

-- Opening Stock Items
CREATE TABLE IF NOT EXISTS opening_stock_items (
    item_id    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID          NOT NULL REFERENCES opening_stock_sessions(session_id) ON DELETE CASCADE,
    product_id UUID          NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    qty        NUMERIC(10,3) NOT NULL CHECK (qty > 0),
    UNIQUE (session_id, product_id)
);

-- Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
    category_id SERIAL       PRIMARY KEY,
    store_id    UUID         REFERENCES stores(store_id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    is_system   BOOLEAN      NOT NULL DEFAULT false,
    sort_order  INTEGER      NOT NULL DEFAULT 100,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    expense_id     UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id       UUID          NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    category_id    INTEGER       NOT NULL REFERENCES expense_categories(category_id),
    amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description    TEXT,
    expense_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
    day_closure_id INTEGER       REFERENCES day_closures(id) ON DELETE SET NULL,
    created_by     UUID          REFERENCES app_users(user_id),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Orders  (lightweight order header for delivery/takeaway)
CREATE TABLE IF NOT EXISTS orders (
    id           SERIAL        PRIMARY KEY,
    customer_id  INTEGER       NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    order_date   TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    status       VARCHAR(50)   DEFAULT 'pending'
);


-- ─────────────────────────────────────────────────────────────────────
-- 6. BOOKSTORE / CATALOG TABLES
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS authors (
    author_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS publishers (
    publisher_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
    book_id       UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    isbn13        TEXT,
    title         TEXT          NOT NULL,
    subtitle      TEXT,
    publisher_id  UUID          REFERENCES publishers(publisher_id) ON DELETE SET NULL,
    publish_year  INTEGER,
    edition       TEXT,
    language      TEXT,
    list_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
    sale_price    NUMERIC(12,2),
    tax_rate      NUMERIC(5,2)  NOT NULL DEFAULT 0,
    barcode       TEXT,
    sku           TEXT,
    track_inventory BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_authors (
    book_id   UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES authors(author_id) ON DELETE CASCADE,
    ord       INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (book_id, author_id)
);

CREATE TABLE IF NOT EXISTS book_categories (
    book_id     UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, category_id)
);

CREATE TABLE IF NOT EXISTS product_books (
    product_id   UUID PRIMARY KEY REFERENCES products(product_id) ON DELETE CASCADE,
    book_id      UUID REFERENCES books(book_id) ON DELETE SET NULL,
    isbn13       TEXT,
    subtitle     TEXT,
    publisher_id UUID REFERENCES publishers(publisher_id) ON DELETE SET NULL,
    publish_year INTEGER,
    edition      TEXT,
    language     TEXT
);


-- ─────────────────────────────────────────────────────────────────────
-- 7. SUPPLIERS & PURCHASE ORDERS
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name         TEXT NOT NULL,
    contact_name TEXT,
    phone        TEXT,
    email        TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id        UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id  UUID    NOT NULL REFERENCES suppliers(supplier_id),
    store_id     UUID    NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    po_number    TEXT    NOT NULL UNIQUE,
    invoice_no   VARCHAR(255),
    status       TEXT    NOT NULL CHECK (status IN ('OPEN', 'PENDING', 'RECEIVED', 'CANCELLED')),
    ordered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_at  TIMESTAMPTZ,
    received_at  TIMESTAMPTZ,
    ordered_date DATE GENERATED ALWAYS AS ((ordered_at AT TIME ZONE 'UTC')::date) STORED,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    po_item_id   UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id        UUID          NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    product_id   UUID          NOT NULL REFERENCES products(product_id),
    qty_ordered  NUMERIC(10,3) NOT NULL CHECK (qty_ordered > 0),
    qty_received NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (qty_received >= 0),
    unit_cost    NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────
-- 8. LICENSING TABLES
-- ─────────────────────────────────────────────────────────────────────

-- Main license record (one per store, upserted on activation)
CREATE TABLE IF NOT EXISTS licenses (
    license_id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id                UUID        NOT NULL UNIQUE,
    device_id               VARCHAR(255),
    installation_id         VARCHAR(255),
    convex_subscription_id  VARCHAR(255),
    convex_license_id       VARCHAR(255),
    license_prefix          VARCHAR(50),
    plan                    VARCHAR(50) NOT NULL,
    status                  VARCHAR(50) NOT NULL DEFAULT 'active',
    valid_from              TIMESTAMP   NOT NULL,
    valid_until             TIMESTAMP   NOT NULL,
    activated_at            TIMESTAMP   NOT NULL DEFAULT NOW(),
    customer_name           VARCHAR(255),
    customer_email          VARCHAR(255),
    company_name            VARCHAR(255),
    store_name              VARCHAR(255),
    license_payload_hash    TEXT,
    created_at              TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Current license state (single row per store, always up to date)
CREATE TABLE IF NOT EXISTS license_state (
    id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id                UUID        NOT NULL UNIQUE,
    device_id               VARCHAR(255),
    installation_id         VARCHAR(255),
    plan                    VARCHAR(50) NOT NULL,
    status                  VARCHAR(50) NOT NULL DEFAULT 'active',
    valid_from              TIMESTAMP   NOT NULL,
    valid_until             TIMESTAMP   NOT NULL,
    last_activated_at       TIMESTAMP   NOT NULL DEFAULT NOW(),
    convex_subscription_id  VARCHAR(255),
    last_convex_license_id  VARCHAR(255),
    last_license_prefix     VARCHAR(50),
    customer_name           VARCHAR(255),
    customer_email          VARCHAR(255),
    company_name            VARCHAR(255),
    store_name              VARCHAR(255),
    license_payload_hash    TEXT,
    created_at              TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Append-only activation history
CREATE TABLE IF NOT EXISTS license_activations (
    id                     UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id               UUID        NOT NULL,
    device_id              VARCHAR(255),
    installation_id        VARCHAR(255),
    convex_subscription_id VARCHAR(255),
    convex_license_id      VARCHAR(255),
    license_prefix         VARCHAR(50),
    plan                   VARCHAR(50) NOT NULL,
    validity_days          INTEGER,
    valid_from             TIMESTAMP   NOT NULL,
    valid_until            TIMESTAMP   NOT NULL,
    activated_at           TIMESTAMP   NOT NULL DEFAULT NOW(),
    activation_result      VARCHAR(50) NOT NULL DEFAULT 'success',
    created_at             TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Legacy: per-device activations
CREATE TABLE IF NOT EXISTS device_activations (
    activation_id       UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id            UUID         NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    license_id          UUID         REFERENCES licenses(license_id) ON DELETE CASCADE,
    device_fingerprint  VARCHAR(255) NOT NULL,
    device_name         VARCHAR(255),
    device_info         JSONB,
    is_active           BOOLEAN      DEFAULT true,
    activated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    last_validated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Legacy: validation audit log
CREATE TABLE IF NOT EXISTS license_validations (
    validation_id      UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id           UUID         REFERENCES stores(store_id) ON DELETE CASCADE,
    license_id         UUID         REFERENCES licenses(license_id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255),
    validation_result  VARCHAR(50),
    ip_address         VARCHAR(45),
    user_agent         TEXT,
    created_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);


-- ─────────────────────────────────────────────────────────────────────
-- 9. RESTAURANT MODULE TABLES
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS restaurant_table_sessions (
    session_id   UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id     UUID     NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    terminal_id  UUID     NOT NULL REFERENCES terminals(terminal_id) ON DELETE RESTRICT,
    cashier_id   UUID     NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
    table_number INTEGER  NOT NULL CHECK (table_number > 0),
    guest_count  INTEGER  NOT NULL CHECK (guest_count > 0),
    waiter_name  TEXT,
    seated_at    TIMESTAMPTZ NOT NULL,
    closed_at    TIMESTAMPTZ NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'closed' CHECK (status IN ('open', 'closed', 'cancelled')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_sale_context (
    sale_id                  UUID          PRIMARY KEY REFERENCES sales(sale_id) ON DELETE CASCADE,
    session_id               UUID          REFERENCES restaurant_table_sessions(session_id) ON DELETE SET NULL,
    service_fee_enabled      BOOLEAN       NOT NULL DEFAULT false,
    service_fee_rate         NUMERIC(5,2)  NOT NULL DEFAULT 0,
    service_fee_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal_before_service  NUMERIC(12,2) NOT NULL DEFAULT 0,
    checkout_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    notes                    TEXT,
    created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_menus (
    menu_id       UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id      UUID        NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    description   TEXT,
    menu_type     TEXT        NOT NULL DEFAULT 'regular'
                              CHECK (menu_type IN ('regular','holiday','seasonal','event','special')),
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    display_order INTEGER     NOT NULL DEFAULT 0,
    categories    JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────
-- 10. SYSTEM / SUPPORT TABLES
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_logs (
    log_id     UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id   UUID    NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    user_id    UUID    REFERENCES app_users(user_id) ON DELETE SET NULL,
    action     TEXT    NOT NULL,
    module     TEXT    NOT NULL,
    details    JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_backups (
    backup_id    UUID   DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id     UUID   NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    backup_type  TEXT   NOT NULL CHECK (backup_type IN ('manual', 'scheduled', 'auto')),
    status       TEXT   NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
    file_path    TEXT,
    file_size    BIGINT,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_by   UUID   REFERENCES app_users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notification_prefs (
    id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id   UUID    NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    type       TEXT    NOT NULL CHECK (type IN ('stock', 'sales', 'system', 'backup', 'reports')),
    active     BOOLEAN NOT NULL DEFAULT true,
    frequency  TEXT    NOT NULL CHECK (frequency IN ('immediate', 'daily', 'weekly')),
    threshold_value NUMERIC(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_settings (
    store_id          UUID    PRIMARY KEY REFERENCES stores(store_id) ON DELETE CASCADE,
    sales             BOOLEAN NOT NULL DEFAULT true,
    inventory         BOOLEAN NOT NULL DEFAULT true,
    customers         BOOLEAN NOT NULL DEFAULT false,
    performance       BOOLEAN NOT NULL DEFAULT true,
    report_frequency  TEXT    NOT NULL DEFAULT 'weekly'
                              CHECK (report_frequency IN ('daily', 'weekly', 'monthly')),
    retention         TEXT    NOT NULL DEFAULT '6months'
                              CHECK (retention IN ('3months', '6months', '1year', '2years')),
    auto_reports      BOOLEAN DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────
-- 11. VIEWS
-- ─────────────────────────────────────────────────────────────────────

-- Product catalog with book metadata
CREATE OR REPLACE VIEW catalog AS
SELECT
    p.product_id, p.sku, p.barcode, p.name, p.product_type,
    p.list_price, p.sale_price, p.tax_rate, p.track_inventory,
    pb.book_id, pb.isbn13, pb.subtitle,
    pb.publisher_id, pb.publish_year, pb.edition, pb.language
FROM products p
LEFT JOIN product_books pb ON pb.product_id = p.product_id;

-- Stock balances derived from movements (supplemental; stock_balances table is authoritative)
CREATE OR REPLACE VIEW product_stock_balances AS
SELECT
    store_id,
    product_id,
    SUM(qty)::numeric(18,2) AS qty_on_hand
FROM stock_movements
GROUP BY store_id, product_id;

-- Inventory list
CREATE OR REPLACE VIEW inventory_list AS
SELECT
    p.product_id, p.name, p.sku, p.barcode, p.product_type,
    sb.store_id,
    COALESCE(sb.qty_on_hand::numeric, 0) AS qty_on_hand
FROM products p
LEFT JOIN stock_balances sb ON sb.product_id = p.product_id;


-- ─────────────────────────────────────────────────────────────────────
-- 12. TRIGGERS
-- ─────────────────────────────────────────────────────────────────────

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_store_settings_updated_at     ON store_settings;
CREATE TRIGGER trg_store_settings_updated_at
BEFORE UPDATE ON store_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_books_updated_at ON books;
CREATE TRIGGER trg_books_updated_at
BEFORE UPDATE ON books
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON suppliers;
CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER trg_purchase_orders_updated_at
BEFORE UPDATE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_purchase_order_items_updated_at ON purchase_order_items;
CREATE TRIGGER trg_purchase_order_items_updated_at
BEFORE UPDATE ON purchase_order_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_licenses_updated_at ON licenses;
CREATE TRIGGER trg_licenses_updated_at
BEFORE UPDATE ON licenses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_notification_prefs_updated_at ON notification_prefs;
CREATE TRIGGER trg_notification_prefs_updated_at
BEFORE UPDATE ON notification_prefs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_analytics_settings_updated_at ON analytics_settings;
CREATE TRIGGER trg_analytics_settings_updated_at
BEFORE UPDATE ON analytics_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_product_types_updated_at ON product_types;
CREATE TRIGGER trg_product_types_updated_at
BEFORE UPDATE ON product_types
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_restaurant_menus_updated_at ON restaurant_menus;
CREATE TRIGGER trg_restaurant_menus_updated_at
BEFORE UPDATE ON restaurant_menus
FOR EACH ROW EXECUTE FUNCTION set_restaurant_menus_updated_at();

-- Full-text search trigger for products
DROP TRIGGER IF EXISTS trigger_update_product_name_tsvector ON products;
CREATE TRIGGER trigger_update_product_name_tsvector
BEFORE INSERT OR UPDATE OF name ON products
FOR EACH ROW EXECUTE FUNCTION update_product_name_tsvector();


-- ─────────────────────────────────────────────────────────────────────
-- 13. INDEXES
-- ─────────────────────────────────────────────────────────────────────

-- Products
CREATE INDEX IF NOT EXISTS idx_products_barcode          ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_sku              ON products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_product_type     ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_track_inventory  ON products(track_inventory);
CREATE INDEX IF NOT EXISTS idx_products_created_at       ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_name_tsvector    ON products USING gin(name_tsvector);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm        ON products USING gin(name gin_trgm_ops);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_phone           ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email           ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_created_at      ON customers(created_at DESC);

-- Sales
CREATE INDEX IF NOT EXISTS idx_sales_store_id            ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id         ON sales(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_status              ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_store_created_at    ON sales(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_created_at          ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_created_date        ON sales(created_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_client_sale_id ON sales(client_sale_id) WHERE client_sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_store_open_closure  ON sales(store_id, day_closure_id)
    WHERE day_closure_id IS NULL AND status = 'paid';

-- Sale Items
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id        ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id     ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_line_total     ON sale_items(line_total);

-- Stock Movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_store_id  ON stock_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created ON stock_movements(product_id, created_at DESC);

-- Stock Balances
CREATE INDEX IF NOT EXISTS idx_stock_balances_store_product ON stock_balances(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_updated_at    ON stock_balances(updated_at DESC);

-- Purchase Orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_store_id     ON purchase_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id  ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status       ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_ordered_at   ON purchase_orders(ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_ordered_date ON purchase_orders(ordered_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_store_ordered_at ON purchase_orders(store_id, ordered_at);

-- Purchase Order Items
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id      ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_id ON purchase_order_items(product_id);

-- Suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_created_at ON suppliers(created_at DESC);

-- App Users
DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS idx_app_users_username_lower
        ON app_users(LOWER(username));
EXCEPTION WHEN OTHERS THEN
    CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username);
END $$;
CREATE INDEX IF NOT EXISTS idx_app_users_is_active ON app_users(is_active);
DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS idx_app_users_active_username
        ON app_users(is_active, LOWER(username));
EXCEPTION WHEN OTHERS THEN
    CREATE INDEX IF NOT EXISTS idx_app_users_active_username_alt ON app_users(is_active, username);
END $$;

-- Stores
CREATE INDEX IF NOT EXISTS idx_stores_is_active       ON stores(is_active);
CREATE INDEX IF NOT EXISTS idx_stores_active_created  ON stores(is_active, created_at) WHERE is_active = true;

-- Terminals
CREATE INDEX IF NOT EXISTS idx_terminals_store_id              ON terminals(store_id);
CREATE INDEX IF NOT EXISTS idx_terminals_is_active             ON terminals(is_active);
CREATE INDEX IF NOT EXISTS idx_terminals_store_active_created  ON terminals(store_id, is_active, created_at) WHERE is_active = true;

-- Day Closures
CREATE INDEX IF NOT EXISTS idx_day_closures_store_closed_at ON day_closures(store_id, closed_at DESC);

-- Licenses
CREATE INDEX IF NOT EXISTS idx_licenses_store_id          ON licenses(store_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status            ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_valid_until       ON licenses(valid_until);
CREATE INDEX IF NOT EXISTS idx_licenses_installation_id   ON licenses(installation_id);

-- License State & Activations
CREATE INDEX IF NOT EXISTS idx_license_state_store_id        ON license_state(store_id);
CREATE INDEX IF NOT EXISTS idx_license_state_valid_until     ON license_state(valid_until);
CREATE INDEX IF NOT EXISTS idx_license_activations_store_id  ON license_activations(store_id);
CREATE INDEX IF NOT EXISTS idx_license_activations_activated_at ON license_activations(activated_at DESC);

-- Device Activations
CREATE INDEX IF NOT EXISTS idx_device_activations_license_id         ON device_activations(license_id);
CREATE INDEX IF NOT EXISTS idx_device_activations_device_fingerprint ON device_activations(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_device_activations_license_fingerprint_active
    ON device_activations(license_id, device_fingerprint, is_active);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_store_date       ON expenses(store_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_unclosed         ON expenses(store_id, day_closure_id) WHERE day_closure_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_expense_categories_store  ON expense_categories(store_id);

-- Opening Stock
CREATE INDEX IF NOT EXISTS idx_opening_stock_sessions_store ON opening_stock_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_opening_stock_items_session  ON opening_stock_items(session_id);

-- Receipt Counters
CREATE INDEX IF NOT EXISTS idx_daily_receipt_counters_store_date ON daily_receipt_counters(store_id, date);

-- Restaurant
CREATE INDEX IF NOT EXISTS idx_restaurant_sessions_store_created  ON restaurant_table_sessions(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_sessions_table_status   ON restaurant_table_sessions(table_number, status, closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_sale_context_checkout_at ON restaurant_sale_context(checkout_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_menus_store_id          ON restaurant_menus(store_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_menus_store_active      ON restaurant_menus(store_id, is_active);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Unique index for expense_categories
CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_cat_global_name
    ON expense_categories (name) WHERE store_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_cat_store_name
    ON expense_categories (store_id, name) WHERE store_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────
-- 14. SEED DATA
-- ─────────────────────────────────────────────────────────────────────

-- System expense categories (store_id IS NULL = global, non-deletable)
INSERT INTO expense_categories (name, is_system, sort_order) VALUES
    ('Rent',                  true,  1),
    ('Electricity',           true,  2),
    ('Internet',              true,  3),
    ('Cleaning',              true,  4),
    ('Maintenance',           true,  5),
    ('Fuel',                  true,  6),
    ('Staff Meals',           true,  7),
    ('Packaging',             true,  8),
    ('Delivery Costs',        true,  9),
    ('Supplier Fees',         true, 10),
    ('Cash Drawer Shortage',  true, 11),
    ('Miscellaneous',         true, 12)
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- TABLE COMMENTS
-- ─────────────────────────────────────────────────────────────────────
COMMENT ON TABLE daily_receipt_counters IS 'Atomic counter for daily receipt number generation per store';
COMMENT ON TABLE stock_balances         IS 'Real-time stock balances maintained by application UPSERT';

COMMENT ON COLUMN stores.phone                      IS 'Store phone number for receipts and contact';
COMMENT ON COLUMN store_settings.lbp_exchange_rate  IS 'Exchange rate: LBP per 1 unit of store currency. NULL = disabled.';
COMMENT ON COLUMN store_settings.show_lbp_price     IS 'Show secondary LBP price in POS';
COMMENT ON COLUMN store_settings.lbp_primary_price  IS 'Show LBP as primary price (requires show_lbp_price = true)';
COMMENT ON COLUMN store_settings.round_lbp_to_1000  IS 'Round LBP amounts up to the nearest 1000';
COMMENT ON COLUMN store_settings.label_show_lbp     IS 'Show LBP secondary price on shelf labels';
COMMENT ON COLUMN store_settings.pos_module_type     IS 'POS mode: store, retail_store, or restaurant';
COMMENT ON COLUMN store_settings.label_section_order IS 'Display order of label sections: header, title, lbp, price';
COMMENT ON COLUMN store_settings.heading_size        IS 'Global heading font scale: sm | md | lg | xl';
COMMENT ON COLUMN store_settings.body_size           IS 'Global body font scale: sm | md | lg | xl';
COMMENT ON COLUMN store_settings.label_header_align  IS 'Store name bar: left | center | right';
COMMENT ON COLUMN store_settings.label_title_align   IS 'Product name block alignment';
COMMENT ON COLUMN store_settings.label_lbp_row_align IS 'LBP row: between | left | center | right';
COMMENT ON COLUMN store_settings.label_price_row_align IS 'Price band alignment';
COMMENT ON COLUMN store_settings.lbp_primary_price   IS 'If true, LBP is shown as the primary price in POS cart';
COMMENT ON COLUMN product_types.press_to_add         IS 'Adds product to cart directly (qty 1) bypassing Quick Add modal';
COMMENT ON COLUMN sales.day_closure_id               IS 'Set when sale is locked in a Z closure; non-null sales are immutable';
COMMENT ON COLUMN day_closures.cash_breakdown        IS 'Notes and coins counted during closure';

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================
