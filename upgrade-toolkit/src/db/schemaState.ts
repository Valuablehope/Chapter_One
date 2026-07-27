import { Client } from 'pg';
import * as fs from 'fs';

// Must match backend/src/scripts/migrate.ts's hardcoded legacy list exactly
// (lines ~172-194) — on a database that predates the `migrations` tracking
// table, migrate.ts treats these filenames as already-applied the first time
// it runs, rather than actually re-executing them. Reporting must reflect
// that same interpretation, or "pending" counts here would overstate what
// migrate.ts will really do.
const LEGACY_PRESEED_FILES = [
  '000_base_schema.sql',
  '001_create_receipt_counters.sql',
  '002_ensure_stock_balances_table.sql',
  '003_add_fulltext_search.sql',
  '004_add_client_sale_id.sql',
  '005_restore_missing_tables.sql',
  '006_add_missing_store_settings_columns.sql',
  '007_store_pos_module_and_restaurant_menus.sql',
  '008_ensure_public_store_settings_restaurant_columns.sql',
  '009_add_restaurant_sales_context.sql',
  '010_restaurant_menus_table.sql',
  '011_drop_legacy_store_settings_restaurant_menus.sql',
  '012_add_product_unit_of_measure.sql',
  '013_add_product_types.sql',
  '014_move_display_on_pos.sql',
  '015_alter_qty_to_numeric.sql',
  '016_add_margin_pct_to_products.sql',
  '017_add_cancelled_to_sale_status.sql',
  '018_add_cancelled_to_movement_reason.sql',
  '019_add_lbp_exchange_rate.sql',
  'performance_indexes.sql',
];

export interface SchemaState {
  migrationsTableExists: boolean;
  appUsersTableExists: boolean;
  legacyPreSeedWillApply: boolean;
  appliedFiles: string[];
  pendingFiles: string[];
  allFiles: string[];
}

export async function readSchemaState(client: Client, migrationsDir: string): Promise<SchemaState> {
  const tableCheck = await client.query(`
    SELECT
      EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations') AS migrations_exists,
      EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_users') AS app_users_exists
  `);
  const migrationsTableExists: boolean = tableCheck.rows[0].migrations_exists;
  const appUsersTableExists: boolean = tableCheck.rows[0].app_users_exists;

  let appliedFiles: string[] = [];
  if (migrationsTableExists) {
    const res = await client.query('SELECT name FROM migrations ORDER BY id');
    appliedFiles = res.rows.map((r) => r.name as string);
  }

  const legacyPreSeedWillApply = appUsersTableExists && appliedFiles.length === 0;
  const effectiveAppliedSet = new Set(appliedFiles);
  if (legacyPreSeedWillApply) {
    for (const f of LEGACY_PRESEED_FILES) effectiveAppliedSet.add(f);
  }

  const allFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const pendingFiles = allFiles.filter((f) => !effectiveAppliedSet.has(f));

  return {
    migrationsTableExists,
    appUsersTableExists,
    legacyPreSeedWillApply,
    appliedFiles,
    pendingFiles,
    allFiles,
  };
}
