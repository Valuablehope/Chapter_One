import * as fs from 'fs';
import * as path from 'path';
import { Manifest } from '../types';

export function writeManifest(runDir: string, manifest: Manifest): string {
  const filePath = path.join(runDir, 'manifest.json');
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf8');
  return filePath;
}

export function readManifest(runDir: string): Manifest {
  const filePath = path.join(runDir, 'manifest.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`manifest.json not found in ${runDir} — run "backup" before this step.`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
