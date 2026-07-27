import * as path from 'path';
import { GlobalOptions, loadContext } from './context';
import { readState, writeState } from './state';
import { Logger } from './logging/logger';
import { connect } from './db/client';
import { getOtherActiveConnections } from './db/processGuard';
import { getDatabaseInfo, getRowCounts } from './db/rowCounts';
import { readSchemaState } from './db/schemaState';
import { dumpCustomFormat } from './backup/pgDumpCustom';
import { dumpPlainFormat } from './backup/pgDumpPlain';
import { backupUploads } from './backup/uploadsBackup';
import { writeManifest, readManifest } from './backup/manifest';
import { verifyRestore } from './backup/verifyRestore';
import { copyOffMachine } from './backup/offMachineCopy';
import { runPreflight, PreflightOptions } from './upgrade/preflight';
import { runInstallerSilently } from './upgrade/runInstaller';
import { runMigrate } from './upgrade/runMigrate';
import { runPostVerify } from './upgrade/postVerify';
import { runRollback } from './rollback/rollback';
import { sha256File } from './util/checksum';

// One function per step, used identically by the CLI (src/cli.ts) and the
// browser UI (src/ui/server.ts) so the two front ends can never drift out of
// sync with each other's behavior.

async function assertNoActiveConnections(dbConfig: any, force: boolean, logger: Logger): Promise<void> {
  const client = await connect(dbConfig);
  try {
    const active = await getOtherActiveConnections(client, dbConfig.database);
    if (active.length > 0) {
      const msg = `${active.length} other active connection(s) to "${dbConfig.database}" detected. Close the Chapter One POS app (check Task Manager for any orphaned backend/node process) before continuing.`;
      if (force) {
        logger.warn(`${msg} Proceeding anyway because --force was passed.`);
      } else {
        throw new Error(`${msg} Re-run with force only if you are certain these connections are harmless.`);
      }
    } else {
      logger.info('Confirmed: no other active connections to the target database.');
    }
  } finally {
    await client.end();
  }
}

export async function actionPreflight(opts: PreflightOptions): Promise<string> {
  return runPreflight(opts);
}

export async function actionBackup(runDir: string, globalOpts: GlobalOptions, force: boolean): Promise<void> {
  const state = readState(runDir);
  const logger = new Logger(runDir);
  logger.info('=== BACKUP ===');

  const ctx = loadContext(globalOpts);
  await assertNoActiveConnections(ctx.dbConfig, force, logger);

  const client = await connect(ctx.dbConfig);
  let dbInfo, rowCounts, schemaState;
  try {
    dbInfo = await getDatabaseInfo(client);
    rowCounts = await getRowCounts(client);
    schemaState = await readSchemaState(client, ctx.appInstall.migrationsDir);
  } finally {
    await client.end();
  }

  const customDump = await dumpCustomFormat(ctx.dbConfig, ctx.pg, runDir, logger);
  const plainDump = await dumpPlainFormat(ctx.dbConfig, ctx.pg, runDir, logger);
  const uploads = await backupUploads(ctx.appInstall.uploadsDir, runDir, logger);

  const manifest = {
    createdAt: new Date().toISOString(),
    databaseName: ctx.dbConfig.database,
    appVersionBeforeUpgrade: ctx.appInstall.installedVersion,
    pg: {
      version: dbInfo.version,
      majorVersion: dbInfo.majorVersion,
      encoding: dbInfo.encoding,
      collate: dbInfo.collate,
      ctype: dbInfo.ctype,
    },
    migrations: {
      appliedCount: schemaState.appliedFiles.length,
      pendingCount: schemaState.pendingFiles.length,
      appliedFiles: schemaState.appliedFiles,
      pendingFiles: schemaState.pendingFiles,
    },
    rowCounts,
    uploads: {
      fileCount: uploads.entries.length,
      totalBytes: uploads.totalBytes,
      files: uploads.entries,
    },
    dumps: {
      customDumpFile: path.basename(customDump.filePath),
      customDumpSha256: await sha256File(customDump.filePath),
      customDumpBytes: customDump.bytes,
      plainDumpFile: path.basename(plainDump.filePath),
      plainDumpSha256: await sha256File(plainDump.filePath),
      plainDumpBytes: plainDump.bytes,
    },
  };
  writeManifest(runDir, manifest);

  state.steps.backup = { completedAt: new Date().toISOString() };
  writeState(state);

  logger.info('Backup complete. Next: verify-backup — do not skip this, the dump is not trusted until restore-tested.');
}

export async function actionVerifyBackup(runDir: string, globalOpts: GlobalOptions): Promise<{ verified: boolean; details: string }> {
  const state = readState(runDir);
  const logger = new Logger(runDir);
  logger.info('=== VERIFY-BACKUP ===');

  if (!state.steps.backup) {
    throw new Error('Backup step has not completed for this run directory. Run "backup" first.');
  }

  const ctx = loadContext(globalOpts);
  const manifest = readManifest(runDir);
  const dumpFilePath = path.join(runDir, manifest.dumps.customDumpFile);

  const result = await verifyRestore(ctx.dbConfig, ctx.pg, dumpFilePath, manifest, logger);

  state.steps.verifyBackup = { completedAt: new Date().toISOString(), verified: result.success, details: result.details };
  writeState(state);

  if (!result.success) {
    logger.error(`Backup verification FAILED: ${result.details}`);
  } else {
    logger.info('Backup verification PASSED. Safe to proceed.');
  }

  return { verified: result.success, details: result.details };
}

export async function actionOffsiteCopy(runDir: string, dest: string): Promise<{ dest: string }> {
  const state = readState(runDir);
  const logger = new Logger(runDir);
  logger.info('=== OFFSITE-COPY ===');

  const result = await copyOffMachine(runDir, dest, logger);

  state.steps.offsiteCopy = { completedAt: new Date().toISOString(), dest: result.dest };
  writeState(state);

  return { dest: result.dest };
}

export async function actionUpgrade(
  runDir: string,
  globalOpts: GlobalOptions,
  installerPath: string,
  expectedVersion: string | undefined,
  force: boolean
): Promise<{ exitCode: number; meaning: string }> {
  const state = readState(runDir);
  const logger = new Logger(runDir);
  logger.info('=== UPGRADE ===');

  if (!state.steps.verifyBackup?.verified) {
    throw new Error(
      'Refusing to upgrade: the backup for this run has not been verified as restorable. ' +
        'Run "backup" then "verify-backup" and confirm it passes before running "upgrade".'
    );
  }

  const ctxBefore = loadContext(globalOpts);
  await assertNoActiveConnections(ctxBefore.dbConfig, force, logger);

  await runInstallerSilently(installerPath, expectedVersion, logger);

  // Re-discover after install — resourcesPath/migrateScriptPath now point at the new version's files.
  const ctxAfter = loadContext(globalOpts);
  const migrateResult = await runMigrate(ctxAfter.appInstall, ctxAfter.envPath, logger);

  state.steps.upgrade = {
    completedAt: new Date().toISOString(),
    installerPath: path.resolve(installerPath),
    migrateExitCode: migrateResult.exitCode,
  };
  writeState(state);

  if (migrateResult.exitCode !== 0) {
    logger.error(`Migration did not succeed (${migrateResult.meaning}). Do not start the app.`);
  } else {
    logger.info('Migration succeeded. It is now safe to start the app.');
  }

  return migrateResult;
}

export async function actionPostVerify(runDir: string, globalOpts: GlobalOptions): Promise<{ passed: boolean; details: string }> {
  const state = readState(runDir);
  const logger = new Logger(runDir);
  logger.info('=== POST-VERIFY ===');

  const ctx = loadContext(globalOpts);
  const manifest = readManifest(runDir);
  const result = await runPostVerify(ctx.dbConfig, ctx.appInstall, manifest, logger);

  state.steps.postVerify = { completedAt: new Date().toISOString(), passed: result.passed, details: result.details };
  writeState(state);

  return { passed: result.passed, details: result.details };
}

export async function actionRollback(
  runDir: string,
  globalOpts: GlobalOptions,
  previousInstallerPath: string | undefined
): Promise<void> {
  const state = readState(runDir);
  const logger = new Logger(runDir);

  const manifest = readManifest(runDir);
  const dumpFilePath = path.join(runDir, manifest.dumps.customDumpFile);
  const uploadsBackupDir = path.join(runDir, 'uploads_backup');

  const ctx = loadContext(globalOpts);
  await runRollback(ctx.dbConfig, ctx.pg, ctx.appInstall, { dumpFilePath, uploadsBackupDir, previousInstallerPath }, logger);

  state.steps.rollback = { completedAt: new Date().toISOString() };
  writeState(state);
}
