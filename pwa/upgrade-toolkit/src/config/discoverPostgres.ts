import * as fs from 'fs';
import * as path from 'path';
import { PgBinaries } from '../types';

// Mirrors updater/dbBackup.js's findPgDump(): scans the standard EDB Windows
// install locations and prefers the newest version directory found.
function findPgBinDir(): string | null {
  const programFileDirs = [
    process.env['ProgramFiles'] || 'C:\\Program Files',
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  ];

  for (const base of programFileDirs) {
    const pgRoot = path.join(base, 'PostgreSQL');
    if (!fs.existsSync(pgRoot)) continue;

    const versions = fs
      .readdirSync(pgRoot)
      .filter((v) => /^\d/.test(v))
      .sort((a, b) => parseFloat(b) - parseFloat(a));

    for (const version of versions) {
      const binDir = path.join(pgRoot, version, 'bin');
      if (fs.existsSync(path.join(binDir, 'pg_dump.exe'))) {
        return binDir;
      }
    }
  }

  return null;
}

export function discoverPostgresBinaries(): PgBinaries {
  const binDir = findPgBinDir();
  if (!binDir) {
    throw new Error(
      'Could not find a PostgreSQL "bin" directory under Program Files. ' +
        'Install PostgreSQL tools (installers/postgresql-installer.exe ships one) or pass --pg-bin-dir explicitly.'
    );
  }

  const pgDump = path.join(binDir, 'pg_dump.exe');
  const pgRestore = path.join(binDir, 'pg_restore.exe');
  const psql = path.join(binDir, 'psql.exe');
  const createdb = path.join(binDir, 'createdb.exe');
  const dropdb = path.join(binDir, 'dropdb.exe');

  for (const bin of [pgDump, pgRestore, psql, createdb, dropdb]) {
    if (!fs.existsSync(bin)) {
      throw new Error(`Expected PostgreSQL binary not found: ${bin}`);
    }
  }

  // bin dir is .../PostgreSQL/<version>/bin — the version segment is the major version.
  const versionSegment = path.basename(path.dirname(binDir));
  const majorVersion = parseInt(versionSegment, 10);
  if (Number.isNaN(majorVersion)) {
    throw new Error(`Could not determine PostgreSQL major version from path: ${binDir}`);
  }

  return { pgDump, pgRestore, psql, createdb, dropdb, majorVersion };
}

export function useExplicitPgBinDir(binDir: string): PgBinaries {
  const pgDump = path.join(binDir, 'pg_dump.exe');
  const pgRestore = path.join(binDir, 'pg_restore.exe');
  const psql = path.join(binDir, 'psql.exe');
  const createdb = path.join(binDir, 'createdb.exe');
  const dropdb = path.join(binDir, 'dropdb.exe');

  for (const bin of [pgDump, pgRestore, psql, createdb, dropdb]) {
    if (!fs.existsSync(bin)) {
      throw new Error(`Expected PostgreSQL binary not found: ${bin}`);
    }
  }

  const versionSegment = path.basename(path.dirname(binDir));
  const majorVersion = parseInt(versionSegment, 10);
  if (Number.isNaN(majorVersion)) {
    throw new Error(`Could not determine PostgreSQL major version from path: ${binDir}`);
  }

  return { pgDump, pgRestore, psql, createdb, dropdb, majorVersion };
}
