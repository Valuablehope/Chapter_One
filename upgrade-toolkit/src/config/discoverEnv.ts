import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { AppInstall, DbConfig } from '../types';

// electron/src/main.ts's getEnvPath() prefers userData/.env in production
// specifically because it survives app version upgrades, falling back to the
// install directory root and then resources/.env. We replicate that same
// priority order here so the toolkit is guaranteed to read the exact file the
// live app reads — never a re-derived guess.
//
// The one thing we can't hardcode with certainty is the userData folder name:
// Electron derives app.getName() from package.json's top-level "productName"
// field if present, else "name" — and this repo only sets productName inside
// the nested electron-builder "build" block, not at the top level. Rather than
// assume one or the other, we try both known candidates and, failing that,
// scan %AppData% for a directory containing a .env with DB_HOST/DATABASE_URL.
const USER_DATA_NAME_CANDIDATES = ['Chapter One POS', 'chapter-one-pos'];

function looksLikeAppEnv(envPath: string): boolean {
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    return content.includes('DB_HOST=') || content.includes('DATABASE_URL=');
  } catch {
    return false;
  }
}

function scanAppDataForEnv(): string | null {
  const appData = process.env['APPDATA'];
  if (!appData || !fs.existsSync(appData)) return null;

  for (const entry of fs.readdirSync(appData)) {
    if (!/chapter.?one/i.test(entry)) continue;
    const candidate = path.join(appData, entry, '.env');
    if (fs.existsSync(candidate) && looksLikeAppEnv(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function discoverEnvPath(appInstall: AppInstall, explicitEnvPath?: string): string {
  if (explicitEnvPath) {
    if (!fs.existsSync(explicitEnvPath)) {
      throw new Error(`--env-path was given but does not exist: ${explicitEnvPath}`);
    }
    if (fs.statSync(explicitEnvPath).isDirectory()) {
      const guess = path.join(explicitEnvPath, '.env');
      throw new Error(
        `--env-path must point at the .env FILE itself, not a folder. You passed a directory: ${explicitEnvPath}. ` +
          `Did you mean: ${guess}${fs.existsSync(guess) ? '' : ' (not found there either — leave this field blank to let auto-discovery find it)'}`
      );
    }
    return explicitEnvPath;
  }

  const appData = process.env['APPDATA'];
  if (appData) {
    for (const name of USER_DATA_NAME_CANDIDATES) {
      const candidate = path.join(appData, name, '.env');
      if (fs.existsSync(candidate) && looksLikeAppEnv(candidate)) {
        return candidate;
      }
    }
  }

  const installRootEnv = path.join(appInstall.installDir, '.env');
  if (fs.existsSync(installRootEnv) && looksLikeAppEnv(installRootEnv)) {
    return installRootEnv;
  }

  const resourcesEnv = path.join(appInstall.resourcesPath, '.env');
  if (fs.existsSync(resourcesEnv) && looksLikeAppEnv(resourcesEnv)) {
    return resourcesEnv;
  }

  const scanned = scanAppDataForEnv();
  if (scanned) return scanned;

  throw new Error(
    'Could not find the app\'s .env file (checked %AppData%\\Chapter One POS, ' +
      '%AppData%\\chapter-one-pos, the install directory root, resources\\.env, and scanned ' +
      '%AppData% for a matching folder). Pass --env-path <path> explicitly.'
  );
}

export function readDbConfig(envPath: string): DbConfig {
  const parsed = dotenv.parse(fs.readFileSync(envPath));

  if (parsed.DATABASE_URL) {
    const url = new URL(parsed.DATABASE_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
    };
  }

  if (!parsed.DB_HOST || !parsed.DB_USER || !parsed.DB_NAME) {
    throw new Error(`.env at ${envPath} has neither DATABASE_URL nor DB_HOST/DB_USER/DB_NAME set.`);
  }

  return {
    host: parsed.DB_HOST,
    port: parseInt(parsed.DB_PORT || '5432', 10),
    user: parsed.DB_USER,
    password: parsed.DB_PASSWORD || '',
    database: parsed.DB_NAME,
  };
}
