import * as fs from 'fs';
import * as path from 'path';
import { sha256File } from '../util/checksum';
import { Logger } from '../logging/logger';

function listFilesRecursive(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(listFilesRecursive(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

// Protects against disk/machine failure during the upgrade itself by getting
// a checksum-verified copy of the whole run (dumps + uploads + manifest +
// logs) off the client's machine before anything destructive happens.
export async function copyOffMachine(runDir: string, destRoot: string, logger: Logger): Promise<{ dest: string; verifiedFiles: number }> {
  const dest = path.join(destRoot, path.basename(runDir));
  fs.mkdirSync(dest, { recursive: true });

  const sourceFiles = listFilesRecursive(runDir);
  let verifiedFiles = 0;

  for (const sourceFile of sourceFiles) {
    const relativePath = path.relative(runDir, sourceFile);
    const destFile = path.join(dest, relativePath);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(sourceFile, destFile);

    const [sourceHash, destHash] = await Promise.all([sha256File(sourceFile), sha256File(destFile)]);
    if (sourceHash !== destHash) {
      throw new Error(`Checksum mismatch after off-machine copy for "${relativePath}" — the destination may be unreliable.`);
    }
    verifiedFiles++;
  }

  logger.info(`Copied and checksum-verified ${verifiedFiles} file(s) to ${dest}`);
  return { dest, verifiedFiles };
}
