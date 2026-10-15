const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

// Search common Windows PostgreSQL installation paths for a named binary
// (pg_dump.exe, psql.exe). Newest version is preferred so we get the most
// capable tooling.
function findPgBinary(binaryName) {
  const programFileDirs = [
    process.env['ProgramFiles'] || 'C:\\Program Files',
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  ];

  for (const base of programFileDirs) {
    const pgRoot = path.join(base, 'PostgreSQL');
    if (!fs.existsSync(pgRoot)) continue;

    const versions = fs.readdirSync(pgRoot)
      .filter(v => /^\d/.test(v))
      .sort((a, b) => parseFloat(b) - parseFloat(a)); // newest first

    for (const version of versions) {
      const candidate = path.join(pgRoot, version, 'bin', binaryName);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}

function findPgDump() {
  return findPgBinary('pg_dump.exe');
}

function findPsql() {
  return findPgBinary('psql.exe');
}

// Resolves connection details from a dbConfig object, preferring individual
// fields and falling back to parsing a connectionString. Shared by
// createBackup and restoreBackup so both agree on the same target database.
function resolveConnection(dbConfig) {
  let host = dbConfig.host || 'localhost';
  let port = String(dbConfig.port || '5432');
  let user = dbConfig.user || 'postgres';
  let password = dbConfig.password || '';
  let database = dbConfig.database;

  if (!database && dbConfig.connectionString) {
    try {
      const url = new URL(dbConfig.connectionString);
      host = url.hostname || host;
      port = url.port || port;
      user = decodeURIComponent(url.username) || user;
      password = decodeURIComponent(url.password) || password;
      database = url.pathname.slice(1) || database;
    } catch {
      logger.warn('Could not parse connectionString; using individual config vars.');
    }
  }

  return { host, port, user, password, database };
}

function buildTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

/**
 * Creates a plain-SQL pg_dump backup of the application database onto the
 * client's Desktop. Returns { success, backupPath?, error? }.
 *
 * @param {object} dbConfig  { host, port, user, password, database, connectionString? }
 * @param {string} desktopPath  Absolute path to the user's Desktop directory.
 * @param {string} [timestamp]  Pass the same timestamp used elsewhere (e.g. an uploads
 *   stash taken alongside this backup) so the two files are easy to pair up.
 */
async function createBackup(dbConfig, desktopPath, timestamp) {
  logger.info('Starting pre-update database backup...');

  const pgDump = findPgDump();
  if (!pgDump) {
    const msg = 'pg_dump not found in any PostgreSQL installation directory. Backup skipped — update will proceed without a backup.';
    logger.warn(msg);
    return { success: false, error: msg };
  }

  logger.info(`Using pg_dump: ${pgDump}`);

  const { host, port, user, password, database } = resolveConnection(dbConfig);

  if (!database) {
    const msg = 'Database name could not be determined from config. Backup skipped.';
    logger.warn(msg);
    return { success: false, error: msg };
  }

  const fileName = `chapter_one_backup_${timestamp || buildTimestamp()}.sql`;
  const backupPath = path.join(desktopPath, fileName);

  const args = [
    '-h', host,
    '-p', port,
    '-U', user,
    '-d', database,
    '-F', 'p',           // plain SQL — human-readable, no special restore tool needed
    '--no-password',     // password supplied via PGPASSWORD env var
    '-f', backupPath,
  ];

  const env = { ...process.env, PGPASSWORD: password };

  return new Promise((resolve) => {
    execFile(pgDump, args, { env, timeout: 120_000 }, (err, _stdout, stderr) => {
      if (err) {
        const detail = stderr ? stderr.trim() : err.message;
        logger.error(`Backup failed: ${detail}`);
        resolve({ success: false, error: detail });
      } else {
        logger.info(`Backup created successfully at: ${backupPath}`);
        resolve({ success: true, backupPath });
      }
    });
  });
}

function runPsql(psql, host, port, user, password, targetDatabase, extraArgs, timeoutMs) {
  const args = ['-h', host, '-p', port, '-U', user, '-d', targetDatabase, '--no-password', ...extraArgs];
  const env = { ...process.env, PGPASSWORD: password };
  return new Promise((resolve) => {
    execFile(psql, args, { env, timeout: timeoutMs }, (err, _stdout, stderr) => {
      if (err) resolve({ success: false, error: stderr ? stderr.trim() : err.message });
      else resolve({ success: true });
    });
  });
}

/**
 * Restores a plain-SQL pg_dump backup (as produced by createBackup). This is
 * called automatically right after a migration failure to roll the database
 * back to exactly the state captured just before that update's migration run
 * started — restoring "on top of" the current schema is unreliable (the dump's
 * CREATE TABLE/ALTER statements would collide with objects that already
 * exist), so this drops and recreates the database first, matching the same
 * approach upgrade-toolkit/src/rollback/rollback.ts already uses. Only ever
 * runs before the backend server has started (see main.ts's startup order),
 * so there are no other open connections to the database to worry about.
 * Returns { success, error? }.
 *
 * @param {object} dbConfig  Same shape as createBackup's dbConfig.
 * @param {string} backupFilePath  Absolute path to the .sql dump to restore.
 */
async function restoreBackup(dbConfig, backupFilePath) {
  logger.warn(`Starting automatic database restore from: ${backupFilePath}`);

  if (!fs.existsSync(backupFilePath)) {
    const msg = `Backup file not found: ${backupFilePath}`;
    logger.error(msg);
    return { success: false, error: msg };
  }

  const psql = findPsql();
  if (!psql) {
    const msg = 'psql not found in any PostgreSQL installation directory. Cannot restore automatically.';
    logger.error(msg);
    return { success: false, error: msg };
  }

  const { host, port, user, password, database } = resolveConnection(dbConfig);
  if (!database) {
    const msg = 'Database name could not be determined from config. Restore skipped.';
    logger.error(msg);
    return { success: false, error: msg };
  }

  logger.warn(`Dropping and recreating database "${database}" so the backup restores cleanly...`);
  const dropResult = await runPsql(psql, host, port, user, password, 'postgres', ['-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE IF EXISTS "${database}"`], 60_000);
  if (!dropResult.success) {
    return { success: false, error: `Could not drop database for restore: ${dropResult.error}` };
  }

  const createResult = await runPsql(psql, host, port, user, password, 'postgres', ['-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE "${database}"`], 60_000);
  if (!createResult.success) {
    return { success: false, error: `Could not recreate database for restore: ${createResult.error}` };
  }

  const restoreResult = await runPsql(psql, host, port, user, password, database, ['-v', 'ON_ERROR_STOP=1', '-f', backupFilePath], 300_000);
  if (!restoreResult.success) {
    return { success: false, error: `Database was recreated empty but restoring the dump failed: ${restoreResult.error}` };
  }

  logger.info(`Database restored successfully from: ${backupFilePath}`);
  return { success: true };
}

module.exports = { createBackup, restoreBackup, buildTimestamp };
