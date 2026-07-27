import * as fs from 'fs';
import * as path from 'path';
import { DbConfig, PgBinaries } from '../types';
import { runCommand } from '../util/runCommand';
import { Logger } from '../logging/logger';

// Custom format (-Fc) is what makes the backup restorable/verifiable via
// pg_restore — this is the dump verify-backup actually restores, and the one
// rollback uses. See backup/pgDumpPlain.ts for the human-readable fallback.
export async function dumpCustomFormat(
  dbConfig: DbConfig,
  pg: PgBinaries,
  runDir: string,
  logger: Logger
): Promise<{ filePath: string; bytes: number }> {
  const filePath = path.join(runDir, 'chapter_one.dump');
  logger.info(`Running pg_dump (custom format, -Fc) -> ${filePath}`);

  const result = await runCommand(
    pg.pgDump,
    ['-h', dbConfig.host, '-p', String(dbConfig.port), '-U', dbConfig.user, '-d', dbConfig.database, '-F', 'c', '--no-password', '-f', filePath],
    { env: { ...process.env, PGPASSWORD: dbConfig.password }, timeoutMs: 30 * 60 * 1000 }
  );

  if (!result.success) {
    throw new Error(`pg_dump (custom format) failed: ${result.error}`);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`pg_dump reported success but output file is missing: ${filePath}`);
  }

  const bytes = fs.statSync(filePath).size;
  if (bytes === 0) {
    throw new Error(`pg_dump produced a zero-byte file at ${filePath} — treat this as a failed backup, do not proceed.`);
  }

  logger.info(`Custom-format dump complete: ${filePath} (${bytes} bytes)`);
  return { filePath, bytes };
}
