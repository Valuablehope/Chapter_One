-- Terminal connectivity + pairing: lets a physical machine be durably bound
-- to a terminal row (via a one-time admin-issued pairing code) and report
-- liveness back, so the admin panel can show real connection status instead
-- of treating "terminals" as a static label.
--
-- `terminals` was defined in 000_base_schema.sql without `updated_at`, even
-- though TerminalModel.update() already writes to that column — so editing a
-- terminal from the admin panel has been erroring all along. Add it here too.
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS hostname TEXT;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS app_version TEXT;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS pairing_code_hash TEXT;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS pairing_code_expires_at TIMESTAMPTZ;
