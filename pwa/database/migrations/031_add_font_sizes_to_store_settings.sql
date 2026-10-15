-- Migration 031: Add heading_size and body_size to store_settings
-- These control the font scale for heading elements and body text globally.
-- Values: 'sm' | 'md' | 'lg' | 'xl'  (default: 'md')

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS heading_size VARCHAR(10) DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS body_size    VARCHAR(10) DEFAULT 'md';
