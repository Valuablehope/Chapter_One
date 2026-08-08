-- Migration 058: Restore referential integrity lost when 039_add_licenses.sql
-- rebuilt the licenses table with `DROP TABLE IF EXISTS public.licenses CASCADE`.
--
-- That CASCADE silently dropped, and nothing since restored:
--   1. device_activations.license_id -> licenses.license_id FK (ON DELETE CASCADE)
--   2. license_validations.license_id -> licenses.license_id FK (ON DELETE CASCADE)
--   3. licenses.store_id -> stores.store_id FK (ON DELETE CASCADE)
--   4. trg_licenses_updated_at (auto-updates licenses.updated_at on UPDATE)
--
-- Idempotent and safe to run on every install: existing FK-breaking rows are
-- cleared first, and any add that could still fail is guarded so a single
-- corrupted install cannot abort this migration for everyone else.

-- 1. Recreate the updated_at trigger on licenses (uses the shared function
--    from 000_base_schema.sql, already used by products/customers/books/etc).
DROP TRIGGER IF EXISTS trg_licenses_updated_at ON licenses;
CREATE TRIGGER trg_licenses_updated_at
BEFORE UPDATE ON licenses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. device_activations.license_id -> licenses.license_id
-- Clear any reference to a license_id that no longer exists in the rebuilt
-- licenses table before adding the constraint, so ADD CONSTRAINT cannot fail.
UPDATE device_activations
SET license_id = NULL
WHERE license_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM licenses l WHERE l.license_id = device_activations.license_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'device_activations_license_id_fkey'
  ) THEN
    ALTER TABLE device_activations
      ADD CONSTRAINT device_activations_license_id_fkey
      FOREIGN KEY (license_id) REFERENCES licenses(license_id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. license_validations.license_id -> licenses.license_id
UPDATE license_validations
SET license_id = NULL
WHERE license_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM licenses l WHERE l.license_id = license_validations.license_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'license_validations_license_id_fkey'
  ) THEN
    ALTER TABLE license_validations
      ADD CONSTRAINT license_validations_license_id_fkey
      FOREIGN KEY (license_id) REFERENCES licenses(license_id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. licenses.store_id -> stores.store_id
-- store_id is NOT NULL, so an orphaned row (referencing a store that no
-- longer exists) can't be cleared like the license_id columns above. Only
-- add the FK when every row currently resolves to a real store; otherwise
-- skip it with a warning instead of failing the whole migration, so one
-- install with corrupted data can't block updates for every other install.
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM licenses l
  WHERE NOT EXISTS (SELECT 1 FROM stores s WHERE s.store_id = l.store_id);

  IF orphan_count > 0 THEN
    RAISE WARNING '% licenses.store_id row(s) reference a non-existent store; skipping licenses_store_id_fkey. Resolve manually and re-run this migration.', orphan_count;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'licenses_store_id_fkey'
  ) THEN
    ALTER TABLE licenses
      ADD CONSTRAINT licenses_store_id_fkey
      FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE;
  END IF;
END $$;
