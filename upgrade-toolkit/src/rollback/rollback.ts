import * as fs from 'fs';
import * as path from 'path';
import { DbConfig, PgBinaries, AppInstall } from '../types';
import { connect } from '../db/client';
import { runCommand } from '../util/runCommand';
import { Logger } from '../logging/logger';

export interface RollbackOptions {
  dumpFilePath: string;
  uploadsBackupDir: string;
  previousInstallerPath?: string;
}

function copyRecursive(sourceDir: string, destDir: string): void {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

// First-class, always-available recovery path. Deliberately reinstalls the
// previous version's .exe OVER the current install rather than uninstalling
// first — package.json's nsis.deleteAppDataOnUninstall:true would wipe
// userData (and the .env with DB credentials) on an uninstall, so an
// uninstall-then-install rollback would be actively dangerous here.
export async function runRollback(
  dbConfig: DbConfig,
  pg: PgBinaries,
  appInstall: AppInstall,
  options: RollbackOptions,
  logger: Logger
): Promise<void> {
  if (!fs.existsSync(options.dumpFilePath)) {
    throw new Error(
      `Rollback dump file not found: ${options.dumpFilePath}. Refusing to proceed without a real backup to restore from.`
    );
  }

  logger.warn('=== ROLLBACK STARTING — this will DROP and recreate the live database ===');

  const maintenanceClient = await connect(dbConfig, 'postgres');
  try {
    logger.info(`Dropping database "${dbConfig.database}"...`);
    await maintenanceClient.query(`DROP DATABASE IF EXISTS "${dbConfig.database}"`);
    logger.info(`Recreating database "${dbConfig.database}"...`);
    await maintenanceClient.query(`CREATE DATABASE "${dbConfig.database}"`);
  } finally {
    await maintenanceClient.end();
  }

  logger.info(`Restoring ${options.dumpFilePath} into "${dbConfig.database}"...`);
  const restoreResult = await runCommand(
    pg.pgRestore,
    ['-h', dbConfig.host, '-p', String(dbConfig.port), '-U', dbConfig.user, '-d', dbConfig.database, '--no-password', options.dumpFilePath],
    { env: { ...process.env, PGPASSWORD: dbConfig.password }, timeoutMs: 30 * 60 * 1000 }
  );
  if (!restoreResult.success) {
    throw new Error(
      `pg_restore during rollback failed: ${restoreResult.error}. The database is now in an incomplete state — ` +
        `do NOT consider rollback complete, escalate immediately rather than retrying blindly.`
    );
  }

  logger.info('Database restored. Restoring uploads/products from backup...');
  if (fs.existsSync(options.uploadsBackupDir)) {
    fs.rmSync(appInstall.uploadsDir, { recursive: true, force: true });
    fs.mkdirSync(appInstall.uploadsDir, { recursive: true });
    copyRecursive(options.uploadsBackupDir, appInstall.uploadsDir);
    logger.info(`Uploads restored to ${appInstall.uploadsDir}`);
  } else {
    logger.warn(`No uploads backup directory found at ${options.uploadsBackupDir} — skipping uploads restore.`);
  }

  if (options.previousInstallerPath) {
    logger.info(`Reinstalling previous version over the current install: ${options.previousInstallerPath}`);
    const installResult = await runCommand(options.previousInstallerPath, ['/S'], { timeoutMs: 10 * 60 * 1000 });
    if (!installResult.success) {
      throw new Error(
        `Reinstalling the previous version failed: ${installResult.error}. Database/uploads ARE restored, ` +
          `but app files may still be the new version — reinstall manually.`
      );
    }
    logger.info('Previous version reinstalled.');
  } else {
    logger.warn(
      'No --previous-installer supplied — database and uploads are restored, but the app binaries are still the ' +
        'new version. Reinstall the previous version .exe manually (over the current install, never uninstall first) ' +
        'if the new version is not usable, or fix the failing migration and re-run "upgrade".'
    );
  }

  logger.warn('=== ROLLBACK COMPLETE ===');
}
