import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { Logger } from '../logging/logger';
import { discoverAppInstall } from '../config/discoverAppInstall';
import { discoverEnvPath, readDbConfig, looksLikeAppEnv } from '../config/discoverEnv';
import { discoverPostgresBinaries, useExplicitPgBinDir } from '../config/discoverPostgres';
import { connect } from '../db/client';
import { getRowCounts } from '../db/rowCounts';
import { dumpCustomFormat } from '../backup/pgDumpCustom';
import { DbConfig } from '../types';

export interface RepairOrphanedEnvOptions {
  backupsRoot: string;
  oldEnvPath?: string;
  newEnvPath?: string;
  installDir?: string;
  pgBinDir?: string;
  forceAbandonNewDb: boolean;
  // Use the currently-active .env's password against the OLD .env's
  // host/port/user/database instead of the password stored in the old .env
  // itself. Covers the case where the live PostgreSQL password was reset in
  // place during the update (e.g. by a PostgreSQL installer re-run as part
  // of setup) without resources/.env being updated to match — the database
  // and port never actually changed, just the password. Never applied
  // automatically; see the auto-diagnostic on auth failure below, which
  // tells the operator whether this flag would help before they pass it.
  useActivePasswordForOld?: boolean;
  yes: boolean;
}

export interface RepairOrphanedEnvResult {
  runDir: string;
  patched: boolean;
}

// This exists for the failure mode where a legacy client's .env lived at
// resources/.env or the install dir root (pre-userData-persistence versions),
// the actual version bump happened via a plain/manual installer run instead
// of this toolkit's own "upgrade" command, and the new version's first launch
// couldn't find that old .env — so it fell into the first-run setup wizard,
// which silently provisions a brand-new empty PostgreSQL instance on another
// port rather than erroring out. The fix is to repoint the app's *active*
// .env at the real, pre-upgrade database — no data ever needs to move.
//
// Tables that only ever gain rows from real store activity, never from the
// setup wizard's own seeding (one default admin user, one default store/
// settings row). Non-zero here in the "currently active" database means real
// work has already happened on it since the botched upgrade — abandoning it
// by repointing elsewhere would be actual data loss, not just tidying up.
const TRANSACTIONAL_TABLES = [
  'sales',
  'sale_items',
  'sale_payments',
  'purchase_orders',
  'purchase_order_items',
  'stock_movements',
  'customers',
];

const MIN_REAL_TOTAL_ROWS = 10;

interface Probe {
  label: string;
  envPath: string;
  dbConfig: DbConfig;
  reachable: boolean;
  error?: string;
  rowCounts?: Record<string, number>;
}

async function probe(label: string, envPath: string, passwordOverride?: string): Promise<Probe> {
  const dbConfig = readDbConfig(envPath);
  if (passwordOverride !== undefined) dbConfig.password = passwordOverride;
  let client: Client | undefined;
  try {
    client = await connect(dbConfig);
    const rowCounts = await getRowCounts(client);
    return { label, envPath, dbConfig, reachable: true, rowCounts };
  } catch (err: any) {
    return { label, envPath, dbConfig, reachable: false, error: err.message };
  } finally {
    if (client) await client.end();
  }
}

function isAuthError(message: string | undefined): boolean {
  return !!message && /password authentication failed/i.test(message);
}

// Read-only diagnostic connection — never used to write/dump/patch anything
// by itself. Only reports whether it would have worked, so the operator (or
// a follow-up run with --use-active-password-for-old) can decide.
async function tryConnect(dbConfig: DbConfig): Promise<{ ok: boolean; error?: string; rowCounts?: Record<string, number> }> {
  let client: Client | undefined;
  try {
    client = await connect(dbConfig);
    const rowCounts = await getRowCounts(client);
    return { ok: true, rowCounts };
  } catch (err: any) {
    return { ok: false, error: err.message };
  } finally {
    if (client) await client.end();
  }
}

function totalRows(rowCounts: Record<string, number>): number {
  return Object.values(rowCounts).reduce((a, b) => a + b, 0);
}

function transactionalRows(rowCounts: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of TRANSACTIONAL_TABLES) {
    if (t in rowCounts) out[t] = rowCounts[t];
  }
  return out;
}

// Uses a replacer function, not a replacement string, because a raw DB
// password can easily contain "$" — String.replace's string-replacement form
// treats sequences like "$&"/"$1" specially and would silently corrupt it.
function upsertEnvLine(content: string, key: string, value: string): string {
  const lineRegex = new RegExp(`^[\\t ]*${key}[\\t ]*=.*$`, 'm');
  const line = `${key}=${value}`;
  if (lineRegex.test(content)) return content.replace(lineRegex, () => line);
  const sep = content.endsWith('\n') || content.length === 0 ? '' : '\n';
  return `${content}${sep}${line}\n`;
}

// DATABASE_URL wins over discrete DB_* keys in readDbConfig() (see
// config/discoverEnv.ts), so simply upserting DB_HOST etc. would silently do
// nothing if the active .env sets DATABASE_URL instead. Neutralize it rather
// than delete it outright, so the original value is still visible for review.
function commentOutDatabaseUrl(content: string): string {
  return content.replace(/^([\t ]*)DATABASE_URL([\t ]*=.*)$/m, '$1# DATABASE_URL$2 # disabled by repair-orphaned-env');
}

export async function runRepairOrphanedEnv(options: RepairOrphanedEnvOptions): Promise<RepairOrphanedEnvResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(options.backupsRoot, `${timestamp}_repair-orphaned-env`);
  fs.mkdirSync(runDir, { recursive: true });

  const logger = new Logger(runDir);
  logger.info('=== REPAIR-ORPHANED-ENV ===');

  const appInstall = discoverAppInstall(options.installDir);
  logger.info(`Found app install at: ${appInstall.installDir} (version: ${appInstall.installedVersion ?? 'unknown'})`);

  const newEnvPath = options.newEnvPath ?? discoverEnvPath(appInstall);
  logger.info(`Currently-active .env (what the app is running on right now): ${newEnvPath}`);

  let oldEnvPath = options.oldEnvPath;
  if (!oldEnvPath) {
    const candidates = [path.join(appInstall.installDir, '.env'), path.join(appInstall.resourcesPath, '.env')].filter(
      (p) => path.resolve(p) !== path.resolve(newEnvPath) && fs.existsSync(p) && looksLikeAppEnv(p)
    );
    if (candidates.length === 0) {
      throw new Error(
        `Could not find an orphaned pre-upgrade .env distinct from the active one at ${newEnvPath}. Checked ` +
          `${path.join(appInstall.installDir, '.env')} and ${path.join(appInstall.resourcesPath, '.env')}. ` +
          `Pass --old-env-path explicitly if you know where it is.`
      );
    }
    if (candidates.length > 1) {
      throw new Error(`Found more than one candidate old .env (${candidates.join(', ')}) — pass --old-env-path to disambiguate.`);
    }
    oldEnvPath = candidates[0];
  }
  logger.info(`Candidate pre-upgrade .env (believed to hold the real data): ${oldEnvPath}`);

  if (path.resolve(oldEnvPath) === path.resolve(newEnvPath)) {
    logger.info('Old and active .env are the same file — nothing to repair.');
    return { runDir, patched: false };
  }

  const newRawConfig = readDbConfig(newEnvPath);
  const oldPasswordOverride = options.useActivePasswordForOld ? newRawConfig.password : undefined;
  if (oldPasswordOverride !== undefined) {
    logger.info("Using the currently-active .env's password for the old .env's host/port/user/database, per --use-active-password-for-old.");
  }

  const [oldProbe, newProbe] = await Promise.all([
    probe('old (pre-upgrade)', oldEnvPath, oldPasswordOverride),
    probe('new (currently active)', newEnvPath),
  ]);
  fs.writeFileSync(path.join(runDir, 'probe-report.json'), JSON.stringify({ oldProbe, newProbe }, null, 2), 'utf8');

  // Re-running this command after a successful repair (e.g. clicking "Check"
  // again in the UI) would otherwise trip the transactional-data guard below,
  // because the active .env now legitimately points at the same real,
  // non-empty database as the "old" one. Detect that and short-circuit
  // instead of reporting it as a conflict. Password IS part of this
  // comparison deliberately: same host/port/user/database with a DIFFERENT
  // password is exactly the "live password was reset in place" case this
  // command exists to fix, not a no-op — after a real patch, the password
  // matches too, since the patch copies it verbatim from the old .env.
  const sameTarget =
    oldProbe.dbConfig.host === newProbe.dbConfig.host &&
    oldProbe.dbConfig.port === newProbe.dbConfig.port &&
    oldProbe.dbConfig.user === newProbe.dbConfig.user &&
    oldProbe.dbConfig.database === newProbe.dbConfig.database &&
    oldProbe.dbConfig.password === newProbe.dbConfig.password;

  if (sameTarget) {
    logger.info('The active .env already resolves to the same host/port/user/database as the old one — nothing to repair.');
    return { runDir, patched: false };
  }

  if (!oldProbe.reachable) {
    let diagnosticNote = '';

    if (isAuthError(oldProbe.error) && !options.useActivePasswordForOld) {
      logger.warn(
        "Old .env failed with a password error — trying the currently-active .env's password against the same " +
          'host/port/user/database as a read-only diagnostic (this alone changes nothing)...'
      );
      const diag = await tryConnect({ ...oldProbe.dbConfig, password: newProbe.dbConfig.password });

      if (diag.ok) {
        const diagTotal = totalRows(diag.rowCounts!);
        logger.warn(
          `Diagnostic: the ACTIVE .env's password DOES work against the old database (${diagTotal} total rows found). ` +
            `The live PostgreSQL password looks like it was reset in place (e.g. by the update/setup process) without ` +
            `resources\\.env being updated to match — same database, same port, just a stale password on file. Re-run ` +
            `with --use-active-password-for-old to proceed using it.`
        );
        diagnosticNote = " The currently-active .env's password DOES work against this same database — re-run with --use-active-password-for-old.";
      } else {
        logger.warn(`Diagnostic: the active .env's password also failed against the old database (${diag.error}).`);
        diagnosticNote =
          " The currently-active .env's password was also tried against this database and also failed — " +
          'neither file has the real current password. Check the PostgreSQL service directly (or with whoever last touched it) before proceeding.';
      }
    }

    throw new Error(
      `Cannot connect using the old .env (${oldEnvPath}): ${oldProbe.error}. Refusing to touch the active .env — ` +
        `fix connectivity to the real database first (is its PostgreSQL service running?).${diagnosticNote}`
    );
  }

  const oldTotal = totalRows(oldProbe.rowCounts!);
  const oldAppUsers = oldProbe.rowCounts!['app_users'] ?? 0;
  logger.info(
    `Old DB (${oldProbe.dbConfig.host}:${oldProbe.dbConfig.port}/${oldProbe.dbConfig.database}): ${oldTotal} total rows ` +
      `across ${Object.keys(oldProbe.rowCounts!).length} tables, app_users=${oldAppUsers}.`
  );

  if (oldTotal < MIN_REAL_TOTAL_ROWS || oldAppUsers < 1) {
    throw new Error(
      `The old .env's database doesn't look like it holds real data (${oldTotal} rows total, app_users=${oldAppUsers}). ` +
        `Refusing to repoint the app at it — double check --old-env-path is correct.`
    );
  }

  if (newProbe.reachable) {
    const newTotal = totalRows(newProbe.rowCounts!);
    const newTxRows = transactionalRows(newProbe.rowCounts!);
    const newTxTotal = Object.values(newTxRows).reduce((a, b) => a + b, 0);
    logger.info(
      `New DB (${newProbe.dbConfig.host}:${newProbe.dbConfig.port}/${newProbe.dbConfig.database}): ${newTotal} total rows, ` +
        `transactional rows: ${JSON.stringify(newTxRows)}.`
    );

    if (newTxTotal > 0 && !options.forceAbandonNewDb) {
      throw new Error(
        `The database the app is CURRENTLY pointed at already has real transactional activity ` +
          `(${JSON.stringify(newTxRows)}) — this is not just wizard seed data. Repointing to the old database ` +
          `would silently abandon it. This needs a manual merge, not an automatic repoint. If you've verified ` +
          `this data is safe to abandon, re-run with --force-abandon-new-db — it will still be dumped to ` +
          `${runDir} first either way.`
      );
    }
  } else {
    logger.warn(`New DB is unreachable (${newProbe.error}) — nothing there to lose either way.`);
  }

  // Belt-and-braces: dump both sides into this run's own folder before
  // touching anything, independent of whatever backup already exists from an
  // earlier preflight/backup run.
  const pg = options.pgBinDir ? useExplicitPgBinDir(options.pgBinDir) : discoverPostgresBinaries();

  logger.info('Taking a fresh safety dump of the old (real) database before making any changes...');
  const oldDumpDir = path.join(runDir, 'old_db');
  fs.mkdirSync(oldDumpDir, { recursive: true });
  await dumpCustomFormat(oldProbe.dbConfig, pg, oldDumpDir, logger);

  if (newProbe.reachable) {
    logger.info('Also dumping the currently-active (new) database, in case anything in it turns out to matter later...');
    const newDumpDir = path.join(runDir, 'new_db_before_repointing');
    fs.mkdirSync(newDumpDir, { recursive: true });
    await dumpCustomFormat(newProbe.dbConfig, pg, newDumpDir, logger);
  }

  if (!options.yes) {
    logger.info('DRY RUN complete (pass --yes to actually patch the active .env). No .env files were modified.');
    return { runDir, patched: false };
  }

  const backupSuffix = `.before-repair-${timestamp}.bak`;
  fs.copyFileSync(newEnvPath, `${newEnvPath}${backupSuffix}`);
  fs.copyFileSync(newEnvPath, path.join(runDir, 'new-env-before-repair.bak'));
  fs.copyFileSync(oldEnvPath, path.join(runDir, 'old-env-reference.bak'));
  logger.info(`Backed up the active .env to ${newEnvPath}${backupSuffix} (and into the run directory) before editing it.`);

  let content = fs.readFileSync(newEnvPath, 'utf-8');
  content = commentOutDatabaseUrl(content);
  content = upsertEnvLine(content, 'DB_HOST', oldProbe.dbConfig.host);
  content = upsertEnvLine(content, 'DB_PORT', String(oldProbe.dbConfig.port));
  content = upsertEnvLine(content, 'DB_USER', oldProbe.dbConfig.user);
  content = upsertEnvLine(content, 'DB_PASSWORD', oldProbe.dbConfig.password);
  content = upsertEnvLine(content, 'DB_NAME', oldProbe.dbConfig.database);
  fs.writeFileSync(newEnvPath, content, 'utf-8');
  fs.copyFileSync(newEnvPath, path.join(runDir, 'new-env-after-repair.bak'));
  logger.info(
    `Patched ${newEnvPath} — DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME now match the pre-upgrade database. ` +
      `Every other setting (JWT_SECRET, etc.) was left untouched.`
  );

  // Prove the patch actually resolves to the real data before declaring success.
  const verifyConfig = readDbConfig(newEnvPath);
  const verifyClient = await connect(verifyConfig);
  let verifyCounts: Record<string, number>;
  try {
    verifyCounts = await getRowCounts(verifyClient);
  } finally {
    await verifyClient.end();
  }
  const verifyTotal = totalRows(verifyCounts);
  if (verifyTotal !== oldTotal) {
    throw new Error(
      `Post-patch verification mismatch: expected ${oldTotal} total rows (matching the old DB) but the patched ` +
        `.env now resolves to ${verifyTotal}. Restore ${newEnvPath}${backupSuffix} immediately and investigate ` +
        `before starting the app.`
    );
  }

  logger.info(`Verified: the active .env now resolves to the real database (${verifyTotal} total rows, matches the pre-upgrade snapshot).`);
  logger.info(
    'Next: make sure Chapter One POS (and any "ChapterOneBackend" Windows service) is fully closed, then start it — ' +
      'it will run its own pre-migration backup and bring the schema up to date automatically. Log in with an ' +
      'existing real user, not the setup wizard\'s freshly-created admin.'
  );

  return { runDir, patched: true };
}
