import { spawn } from 'child_process';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { AppInstall } from '../types';
import { Logger } from '../logging/logger';

export interface MigrateResult {
  exitCode: number;
  meaning: 'success' | 'migration_failed' | 'db_unreachable' | 'unknown';
}

// Invokes backend/dist/scripts/migrate.js directly, the same way
// electron/src/main.ts's runMigrationsOnStartup() does, but under the
// toolkit's own control — so we get a clean 0/1/2 exit code (see
// backend/src/scripts/migrate.ts's documented exit codes) before the app UI
// ever opens, rather than parsing a startup dialog.
//
// migrate.ts loads its own .env via dotenv.config() but does NOT override
// variables already present in process.env, so pre-populating the child's
// env with the parsed DB_* values here is what actually determines which
// database it connects to — exactly mirroring how main.ts's buildBackendEnv
// primes the subprocess env before spawning this same script.
export async function runMigrate(appInstall: AppInstall, envPath: string, logger: Logger): Promise<MigrateResult> {
  if (!fs.existsSync(appInstall.migrateScriptPath)) {
    throw new Error(`migrate.js not found at ${appInstall.migrateScriptPath} — is the new version actually installed?`);
  }

  const parsedEnv = dotenv.parse(fs.readFileSync(envPath));
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...parsedEnv,
    NODE_ENV: 'production',
    RESOURCES_PATH: appInstall.resourcesPath,
  };

  logger.info(`Running migrate.js directly: ${appInstall.migrateScriptPath}`);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [appInstall.migrateScriptPath], {
      env: childEnv,
      cwd: appInstall.backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => logger.info(`[migrate] ${chunk.toString().trim()}`));
    child.stderr.on('data', (chunk) => logger.error(`[migrate] ${chunk.toString().trim()}`));

    child.on('close', (code) => {
      const exitCode = code ?? -1;
      let meaning: MigrateResult['meaning'] = 'unknown';
      if (exitCode === 0) meaning = 'success';
      else if (exitCode === 1) meaning = 'migration_failed';
      else if (exitCode === 2) meaning = 'db_unreachable';
      logger.info(`migrate.js exited with code ${exitCode} (${meaning})`);
      resolve({ exitCode, meaning });
    });
  });
}
