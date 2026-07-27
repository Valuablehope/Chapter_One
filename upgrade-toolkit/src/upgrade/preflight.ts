import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../logging/logger';
import { discoverPostgresBinaries, useExplicitPgBinDir } from '../config/discoverPostgres';
import { discoverAppInstall } from '../config/discoverAppInstall';
import { discoverEnvPath, readDbConfig } from '../config/discoverEnv';
import { connect } from '../db/client';
import { readSchemaState } from '../db/schemaState';
import { getRowCounts, getDatabaseInfo } from '../db/rowCounts';
import { getOtherActiveConnections } from '../db/processGuard';
import { getFreeBytes, formatBytes } from '../util/diskSpace';
import { checksumExistingUploads } from '../backup/uploadsBackup';
import { writeState } from '../state';
import { RunState } from '../types';

export interface PreflightOptions {
  backupsRoot: string;
  envPath?: string;
  installDir?: string;
  pgBinDir?: string;
}

export async function runPreflight(options: PreflightOptions): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(options.backupsRoot, timestamp);
  fs.mkdirSync(runDir, { recursive: true });

  const logger = new Logger(runDir);
  logger.info('=== PREFLIGHT ===');

  const appInstall = discoverAppInstall(options.installDir);
  logger.info(`Found app install at: ${appInstall.installDir} (version: ${appInstall.installedVersion ?? 'unknown'})`);

  const pg = options.pgBinDir ? useExplicitPgBinDir(options.pgBinDir) : discoverPostgresBinaries();
  logger.info(`Found PostgreSQL client tools (major version ${pg.majorVersion}): ${pg.pgDump}`);

  const envPath = discoverEnvPath(appInstall, options.envPath);
  logger.info(`Using .env at: ${envPath}`);
  const dbConfig = readDbConfig(envPath);

  const client = await connect(dbConfig);
  let report: any;
  try {
    const dbInfo = await getDatabaseInfo(client);
    if (dbInfo.majorVersion !== pg.majorVersion) {
      logger.warn(
        `PostgreSQL client tools are v${pg.majorVersion} but the live server is v${dbInfo.majorVersion} — ` +
          `mismatched major versions can produce dump/restore incompatibilities. Pass --pg-bin-dir to point at a matching version if one is installed.`
      );
    }

    const schemaState = await readSchemaState(client, appInstall.migrationsDir);
    const rowCounts = await getRowCounts(client);
    const otherConnections = await getOtherActiveConnections(client, dbConfig.database);
    const uploadFiles = await checksumExistingUploads(appInstall.uploadsDir);
    const uploadsTotalBytes = uploadFiles.reduce((sum, f) => sum + f.bytes, 0);

    const backupDestFreeBytes = getFreeBytes(runDir);
    const requiredBytes = dbInfo.sizeBytes * 3;

    if (otherConnections.length > 0) {
      logger.warn(
        `${otherConnections.length} other active connection(s) to "${dbConfig.database}" detected — close the ` +
          `Chapter One POS app (and confirm no orphaned backend/node process remains in Task Manager) before running backup/upgrade.`
      );
    } else {
      logger.info('No other active connections to the target database — safe to proceed once you confirm the app is closed.');
    }

    if (backupDestFreeBytes < requiredBytes) {
      logger.warn(
        `Only ${formatBytes(backupDestFreeBytes)} free at the backup destination; recommend at least ${formatBytes(requiredBytes)} ` +
          `(3x current DB size of ${formatBytes(dbInfo.sizeBytes)}). Free up space or choose a different --backups-root before continuing.`
      );
    }

    report = {
      generatedAt: new Date().toISOString(),
      appInstall,
      envPath,
      dbConfigSummary: { host: dbConfig.host, port: dbConfig.port, user: dbConfig.user, database: dbConfig.database },
      pg,
      dbInfo,
      schemaState,
      rowCounts,
      otherActiveConnections: otherConnections,
      uploads: { fileCount: uploadFiles.length, totalBytes: uploadsTotalBytes },
      diskSpace: { backupDestFreeBytes, requiredBytes },
    };
  } finally {
    await client.end();
  }

  fs.writeFileSync(path.join(runDir, 'preflight-report.json'), JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(path.join(runDir, 'preflight-report.txt'), renderReportText(report), 'utf8');

  const state: RunState = {
    runDir,
    createdAt: new Date().toISOString(),
    dbConfig: { host: dbConfig.host, port: dbConfig.port, user: dbConfig.user, database: dbConfig.database },
    steps: { preflight: { completedAt: new Date().toISOString() } },
  };
  writeState(state);

  logger.info(`Preflight complete. Run directory: ${runDir}`);
  logger.info(`Pending migrations: ${report.schemaState.pendingFiles.length} of ${report.schemaState.allFiles.length}`);
  return runDir;
}

function renderReportText(report: any): string {
  const lines: string[] = [];
  lines.push('Chapter One POS — Preflight Report');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(`App install: ${report.appInstall.installDir}`);
  lines.push(`Installed version: ${report.appInstall.installedVersion ?? 'unknown'}`);
  lines.push(`Database: ${report.dbConfigSummary.database} @ ${report.dbConfigSummary.host}:${report.dbConfigSummary.port}`);
  lines.push(`PostgreSQL server: ${report.dbInfo.version}`);
  lines.push(`Database size: ${formatBytes(report.dbInfo.sizeBytes)}`);
  lines.push('');
  lines.push(`Migrations applied: ${report.schemaState.appliedFiles.length}`);
  lines.push(`Migrations pending: ${report.schemaState.pendingFiles.length}`);
  if (report.schemaState.pendingFiles.length > 0) {
    lines.push('Pending files:');
    for (const f of report.schemaState.pendingFiles) lines.push(`  - ${f}`);
  }
  lines.push('');
  lines.push(`Uploaded product image files: ${report.uploads.fileCount} (${formatBytes(report.uploads.totalBytes)})`);
  lines.push('');
  lines.push(`Other active DB connections: ${report.otherActiveConnections.length}`);
  if (report.otherActiveConnections.length > 0) {
    lines.push('*** Close the Chapter One POS app before continuing. ***');
  }
  lines.push('');
  lines.push(`Free space at backup destination: ${formatBytes(report.diskSpace.backupDestFreeBytes)}`);
  lines.push(`Recommended minimum (3x DB size): ${formatBytes(report.diskSpace.requiredBytes)}`);
  return lines.join('\n');
}
