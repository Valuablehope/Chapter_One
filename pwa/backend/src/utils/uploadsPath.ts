import path from 'path';
import fs from 'fs';
import { logger } from './logger';

// Uploaded files (product images, receipt QR, receipt logo) used to live inside
// the install directory (../../uploads relative to this file), which a real
// app update wipes — the NSIS uninstall-old-version step relocates the whole
// install directory before the new version's files land. USER_DATA_PATH is
// injected by Electron's main process (electron/src/main.ts buildBackendEnv)
// and points at app.getPath('userData'), which survives every update the same
// way the app's .env already does — see electron/src/main.ts getEnvPath.
// NOTE: this is coupled to root package.json's "name" field (userData resolves
// against it) — do not change that field without a migration plan.
export function getUploadsRoot(): string {
  if (process.env.USER_DATA_PATH) {
    return path.join(process.env.USER_DATA_PATH, 'uploads');
  }
  return path.join(__dirname, '../../uploads');
}

function getLegacyUploadsRoot(): string {
  return path.join(__dirname, '../../uploads');
}

function copyMissingFilesRecursive(sourceDir: string, destDir: string): number {
  if (!fs.existsSync(sourceDir)) return 0;
  let copied = 0;
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copied += copyMissingFilesRecursive(sourcePath, destPath);
    } else if (entry.isFile() && !fs.existsSync(destPath)) {
      fs.copyFileSync(sourcePath, destPath);
      copied++;
    }
  }
  return copied;
}

// One-time (per file) migration of uploads from the old in-install-dir location
// to the new persistent userData location. Copies rather than moves, and never
// overwrites a file that already exists at the destination, so it's safe to
// call on every production startup. No-ops in dev (no USER_DATA_PATH).
export function migrateLegacyUploads(): void {
  if (!process.env.USER_DATA_PATH) return;

  const legacyRoot = getLegacyUploadsRoot();
  const currentRoot = getUploadsRoot();
  if (legacyRoot === currentRoot) return;

  try {
    const copied = copyMissingFilesRecursive(legacyRoot, currentRoot);
    if (copied > 0) {
      logger.info(`Migrated ${copied} legacy upload file(s) from ${legacyRoot} to ${currentRoot}`);
    }
  } catch (error) {
    logger.warn('Failed to migrate legacy uploads to the persistent uploads directory', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
