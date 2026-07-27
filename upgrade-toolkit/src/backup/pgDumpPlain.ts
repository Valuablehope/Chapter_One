import * as fs from 'fs';
import * as path from 'path';
import { DbConfig, PgBinaries } from '../types';
import { runCommand } from '../util/runCommand';
import { Logger } from '../logging/logger';

// Plain-SQL dump (-F p), restorable with a plain `psql -f` and readable by a
// human without any special tooling — the same format updater/dbBackup.js
// already produces for routine auto-updates, kept here as a fallback
// alongside the custom-format dump that verify-backup and rollback rely on.
export async function dumpPlainFormat(
  dbConfig: DbConfig,
  pg: PgBinaries,
  runDir: string,
  logger: Logger
): Promise<{ filePath: string; bytes: number }> {
  const filePath = path.join(runDir, 'chapter_one.sql');
  logger.info(`Running pg_dump (plain SQL) -> ${filePath}`);

  const result = await runCommand(
    pg.pgDump,
    ['-h', dbConfig.host, '-p', String(dbConfig.port), '-U', dbConfig.user, '-d', dbConfig.database, '-F', 'p', '--no-password', '-f', filePath],
    { env: { ...process.env, PGPASSWORD: dbConfig.password }, timeoutMs: 30 * 60 * 1000 }
  );

  if (!result.success) {
    throw new Error(`pg_dump (plain SQL) failed: ${result.error}`);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`pg_dump reported success but output file is missing: ${filePath}`);
  }

  const bytes = fs.statSync(filePath).size;
  if (bytes === 0) {
    throw new Error(`pg_dump produced a zero-byte file at ${filePath} — treat this as a failed backup, do not proceed.`);
  }

  logger.info(`Plain-SQL dump complete: ${filePath} (${bytes} bytes)`);
  return { filePath, bytes };
}
