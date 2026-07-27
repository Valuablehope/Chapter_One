import { DbConfig, Manifest, AppInstall } from '../types';
import { connect } from '../db/client';
import { readSchemaState } from '../db/schemaState';
import { getRowCounts } from '../db/rowCounts';
import { checksumExistingUploads } from '../backup/uploadsBackup';
import { Logger } from '../logging/logger';

export interface PostVerifyResult {
  passed: boolean;
  details: string;
  remainingPendingMigrations: string[];
  rowCountRegressions: { table: string; before: number; after: number }[];
  uploadsMissing: string[];
  uploadsChanged: string[];
}

export async function runPostVerify(
  dbConfig: DbConfig,
  appInstall: AppInstall,
  manifest: Manifest,
  logger: Logger
): Promise<PostVerifyResult> {
  const client = await connect(dbConfig);
  let remainingPendingMigrations: string[] = [];
  const rowCountRegressions: { table: string; before: number; after: number }[] = [];
  try {
    const schemaState = await readSchemaState(client, appInstall.migrationsDir);
    remainingPendingMigrations = schemaState.pendingFiles;

    const currentCounts = await getRowCounts(client);
    for (const [table, before] of Object.entries(manifest.rowCounts)) {
      const after = currentCounts[table] ?? -1;
      // Growth is fine (the app may have kept running briefly, or other
      // migrations legitimately seed rows) — only a DECREASE is a real problem.
      if (after < before) {
        rowCountRegressions.push({ table, before, after });
      }
    }
  } finally {
    await client.end();
  }

  const currentUploads = await checksumExistingUploads(appInstall.uploadsDir);
  const currentByPath = new Map(currentUploads.map((f) => [f.relativePath, f]));
  const uploadsMissing: string[] = [];
  const uploadsChanged: string[] = [];
  for (const before of manifest.uploads.files) {
    const after = currentByPath.get(before.relativePath);
    if (!after) {
      uploadsMissing.push(before.relativePath);
    } else if (after.sha256 !== before.sha256) {
      uploadsChanged.push(before.relativePath);
    }
  }

  const passed =
    remainingPendingMigrations.length === 0 &&
    rowCountRegressions.length === 0 &&
    uploadsMissing.length === 0 &&
    uploadsChanged.length === 0;

  const details =
    `Remaining pending migrations: ${remainingPendingMigrations.length}; ` +
    `Row count regressions: ${rowCountRegressions.length}; ` +
    `Missing upload files: ${uploadsMissing.length}; ` +
    `Changed upload files: ${uploadsChanged.length}`;

  if (passed) {
    logger.info(`Post-verify PASSED — ${details}`);
  } else {
    logger.error(`Post-verify FAILED — ${details}`);
    if (remainingPendingMigrations.length > 0) logger.error(`Pending: ${remainingPendingMigrations.join(', ')}`);
    if (rowCountRegressions.length > 0) logger.error(`Regressions: ${JSON.stringify(rowCountRegressions)}`);
    if (uploadsMissing.length > 0) logger.error(`Missing uploads: ${uploadsMissing.join(', ')}`);
    if (uploadsChanged.length > 0) logger.error(`Changed uploads: ${uploadsChanged.join(', ')}`);
  }

  logger.info(
    'Manual smoke-test checklist: log in, view a recent sale, view stock levels for a known product, ' +
      'confirm a product image loads on screen.'
  );

  return { passed, details, remainingPendingMigrations, rowCountRegressions, uploadsMissing, uploadsChanged };
}
