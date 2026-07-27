import * as fs from 'fs';
import * as path from 'path';
import { sha256File } from '../util/checksum';
import { UploadFileEntry } from '../types';
import { Logger } from '../logging/logger';

function listFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(listFilesRecursive(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

// Product images live outside the database entirely (resources/backend/uploads/products,
// see backend/src/middleware/upload.ts) and get silently overwritten by every
// version's installer package — this is the toolkit's only defense for them.
export async function backupUploads(
  uploadsDir: string,
  runDir: string,
  logger: Logger
): Promise<{ destDir: string; entries: UploadFileEntry[]; totalBytes: number }> {
  const destDir = path.join(runDir, 'uploads_backup');
  fs.mkdirSync(destDir, { recursive: true });

  if (!fs.existsSync(uploadsDir)) {
    logger.warn(`Uploads directory not found at ${uploadsDir} — nothing to back up.`);
    return { destDir, entries: [], totalBytes: 0 };
  }

  const files = listFilesRecursive(uploadsDir);
  const entries: UploadFileEntry[] = [];
  let totalBytes = 0;

  for (const filePath of files) {
    const relativePath = path.relative(uploadsDir, filePath);
    const destPath = path.join(destDir, relativePath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(filePath, destPath);
    const sha256 = await sha256File(destPath);
    const bytes = fs.statSync(destPath).size;
    totalBytes += bytes;
    entries.push({ relativePath, sha256, bytes });
  }

  logger.info(`Backed up ${entries.length} upload file(s), ${totalBytes} bytes, to ${destDir}`);
  return { destDir, entries, totalBytes };
}

// Used both by preflight (to report current state) and post-verify (to
// reconcile the live uploads directory against the manifest taken at backup time).
export async function checksumExistingUploads(uploadsDir: string): Promise<UploadFileEntry[]> {
  const files = listFilesRecursive(uploadsDir);
  const entries: UploadFileEntry[] = [];
  for (const filePath of files) {
    const relativePath = path.relative(uploadsDir, filePath);
    const sha256 = await sha256File(filePath);
    const bytes = fs.statSync(filePath).size;
    entries.push({ relativePath, sha256, bytes });
  }
  return entries;
}
