const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

// Search common Windows PostgreSQL installation paths for pg_dump.exe.
// Newest version is preferred so we get the most capable dump format.
function findPgDump() {
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
      const candidate = path.join(pgRoot, version, 'bin', 'pg_dump.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
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
 */
async function createBackup(dbConfig, desktopPath) {
  logger.info('Starting pre-update database backup...');

  const pgDump = findPgDump();
  if (!pgDump) {
    const msg = 'pg_dump not found in any PostgreSQL installation directory. Backup skipped — update will proceed without a backup.';
    logger.warn(msg);
    return { success: false, error: msg };
  }

  logger.info(`Using pg_dump: ${pgDump}`);

  // Parse connection details — prefer individual vars, fall back to connection string.
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

  if (!database) {
    const msg = 'Database name could not be determined from config. Backup skipped.';
    logger.warn(msg);
    return { success: false, error: msg };
  }

  const fileName = `chapter_one_backup_${buildTimestamp()}.sql`;
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

module.exports = { createBackup };
