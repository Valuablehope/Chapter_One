-- Add receipt_template and receipt_qr_payment_link to store_settings table
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS receipt_template VARCHAR(20) DEFAULT 'classic';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS receipt_qr_payment_link VARCHAR(500);
