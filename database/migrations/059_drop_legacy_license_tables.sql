-- Migration 059: Drop dead license-related tables.
--
-- device_activations / license_validations: the old per-device activation
-- model. The current flow (manual key entry -> Convex validates -> upsert
-- into `licenses`, see licenseController.convexActivateLicense) never reads
-- or writes these; only the now-removed LicenseModel.activateDevice/
-- validateDevice methods did.
--
-- license_state / license_activations: an abandoned parallel design
-- (introduced by 040_add_license_state.sql). Nothing in the live app ever
-- wrote to them — LicenseStateModel.upsertFromConvex, the only writer, was
-- never called from anywhere. `licenses` remains the real source of truth
-- and is NOT touched by this migration.
--
-- All four tables are confirmed empty on every known install before this
-- migration ships, so this is a zero-data-loss cleanup.

DROP TABLE IF EXISTS device_activations;
DROP TABLE IF EXISTS license_validations;
DROP TABLE IF EXISTS license_state;
DROP TABLE IF EXISTS license_activations;
