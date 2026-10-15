import { DbConfig, PgBinaries, Manifest } from '../types';
import { runCommand } from '../util/runCommand';
import { connect } from '../db/client';
import { getRowCounts } from '../db/rowCounts';
import { Logger } from '../logging/logger';

export interface VerifyRestoreResult {
  success: boolean;
  details: string;
  rowCountMismatches: { table: string; expected: number; actual: number }[];
}

// This is the hard gate: a pg_dump that exits 0 is not proof the backup is
// usable. Restoring it into a throwaway scratch database on the same
// instance and reconciling row counts is what actually proves it — isolated
// by being a separate database (separate lock space), always dropped in the
// finally block so repeated runs don't accumulate scratch databases.
export async function verifyRestore(
  dbConfig: DbConfig,
  pg: PgBinaries,
  dumpFilePath: string,
  manifest: Manifest,
  logger: Logger
): Promise<VerifyRestoreResult> {
  const scratchDbName = `c1_verify_${Date.now()}`;

  const maintenanceClient = await connect(dbConfig, 'postgres');
  try {
    logger.info(`Creating scratch database "${scratchDbName}" (matching source encoding/collation) for restore verification...`);
    await maintenanceClient.query(
      `CREATE DATABASE "${scratchDbName}" TEMPLATE template0 ENCODING '${manifest.pg.encoding}' LC_COLLATE '${manifest.pg.collate}' LC_CTYPE '${manifest.pg.ctype}'`
    );
  } finally {
    await maintenanceClient.end();
  }

  try {
    logger.info(`Restoring ${dumpFilePath} into scratch database "${scratchDbName}"...`);
    const restoreResult = await runCommand(
      pg.pgRestore,
      ['-h', dbConfig.host, '-p', String(dbConfig.port), '-U', dbConfig.user, '-d', scratchDbName, '--no-password', dumpFilePath],
      { env: { ...process.env, PGPASSWORD: dbConfig.password }, timeoutMs: 30 * 60 * 1000 }
    );

    if (!restoreResult.success) {
      return {
        success: false,
        details: `pg_restore into scratch database failed: ${restoreResult.error}`,
        rowCountMismatches: [],
      };
    }

    const scratchClient = await connect(dbConfig, scratchDbName);
    const rowCountMismatches: { table: string; expected: number; actual: number }[] = [];
    try {
      const actualCounts = await getRowCounts(scratchClient);
      for (const [table, expected] of Object.entries(manifest.rowCounts)) {
        const actual = actualCounts[table] ?? -1;
        if (actual !== expected) {
          rowCountMismatches.push({ table, expected, actual });
        }
      }
    } finally {
      await scratchClient.end();
    }

    if (rowCountMismatches.length > 0) {
      return {
        success: false,
        details: `Row count mismatches after restoring into the scratch database — the backup does not fully match the live database.`,
        rowCountMismatches,
      };
    }

    return { success: true, details: 'Restore verified: all row counts match the manifest.', rowCountMismatches: [] };
  } finally {
    const cleanupClient = await connect(dbConfig, 'postgres');
    try {
      logger.info(`Dropping scratch database "${scratchDbName}"...`);
      await cleanupClient.query(`DROP DATABASE IF EXISTS "${scratchDbName}"`);
    } catch (err: any) {
      logger.warn(`Failed to drop scratch database "${scratchDbName}": ${err.message}. Drop it manually when convenient.`);
    } finally {
      await cleanupClient.end();
    }
  }
}
