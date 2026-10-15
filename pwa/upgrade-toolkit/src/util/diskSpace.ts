import { execFileSync } from 'child_process';
import * as path from 'path';

// No cross-platform free-space API exists in core Node; this toolkit only
// ever runs against a client's Windows machine, so shelling out to
// PowerShell is simpler and more reliable than a native dependency.
export function getFreeBytes(targetPath: string): number {
  const resolved = path.resolve(targetPath);
  const driveLetter = resolved.slice(0, 1).toUpperCase();
  const script = `(Get-PSDrive -Name ${driveLetter}).Free`;

  let output: string;
  try {
    output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
    });
  } catch (err: any) {
    throw new Error(`Failed to query free disk space for drive ${driveLetter}: ${err.message}`);
  }

  const bytes = parseInt(output.trim(), 10);
  if (Number.isNaN(bytes)) {
    throw new Error(`Could not parse free disk space for drive ${driveLetter} from output: "${output.trim()}"`);
  }
  return bytes;
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}
