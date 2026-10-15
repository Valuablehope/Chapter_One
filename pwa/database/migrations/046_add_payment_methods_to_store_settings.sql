-- Control which payment methods appear in the Process Payment modal
-- All default to TRUE (visible) so existing stores are unaffected
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pm_cash    BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pm_card    BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pm_voucher BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pm_other   BOOLEAN NOT NULL DEFAULT TRUE;
