import { discoverAppInstall } from './config/discoverAppInstall';
import { discoverPostgresBinaries, useExplicitPgBinDir } from './config/discoverPostgres';
import { discoverEnvPath, readDbConfig } from './config/discoverEnv';
import { AppInstall, PgBinaries, DbConfig } from './types';

export interface GlobalOptions {
  envPath?: string;
  installDir?: string;
  pgBinDir?: string;
}

export interface Context {
  appInstall: AppInstall;
  pg: PgBinaries;
  envPath: string;
  dbConfig: DbConfig;
}

// Every command re-discovers rather than trusting stale state from an
// earlier step — install paths, .env location, and PostgreSQL binaries are
// all cheap to re-resolve and this avoids acting on a stale assumption if
// something on the machine changed between steps (e.g. the app version,
// after the "upgrade" command runs the new installer).
export function loadContext(opts: GlobalOptions): Context {
  const appInstall = discoverAppInstall(opts.installDir);
  const pg = opts.pgBinDir ? useExplicitPgBinDir(opts.pgBinDir) : discoverPostgresBinaries();
  const envPath = discoverEnvPath(appInstall, opts.envPath);
  const dbConfig = readDbConfig(envPath);
  return { appInstall, pg, envPath, dbConfig };
}
