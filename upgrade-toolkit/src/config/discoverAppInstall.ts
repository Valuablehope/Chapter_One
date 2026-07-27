import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { AppInstall } from '../types';

const PRODUCT_NAME = 'Chapter One POS';

// electron-builder registers an uninstall entry under the standard Windows
// uninstall registry keys, but InstallLocation is only reliably populated
// for per-machine installs. This app's nsis config never sets `perMachine`,
// so electron-builder defaults to a PER-USER install (HKCU, InstallLocation
// left blank) — confirmed against a real install, where InstallLocation was
// empty but UninstallString still pointed at the real install directory
// ("<installDir>\Uninstall <name>.exe"), so we fall back to parsing that.
function queryRegistryInstallInfo(): { installLocation: string | null; displayVersion: string | null } {
  const script = `
$keys = @(
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
$match = Get-ItemProperty -Path $keys -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -like '${PRODUCT_NAME}*' } |
  Select-Object -First 1
if ($match) {
  Write-Output "$($match.InstallLocation)|$($match.DisplayVersion)|$($match.UninstallString)"
} else {
  Write-Output '||'
}
`.trim();

  try {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
    }).trim();
    const [installLocationRaw, displayVersionRaw, uninstallStringRaw] = output.split('|');

    let installLocation = installLocationRaw && installLocationRaw.length > 0 ? installLocationRaw : null;
    if (!installLocation && uninstallStringRaw) {
      // UninstallString looks like: "<installDir>\Uninstall <name>.exe" [args...]
      const match = uninstallStringRaw.match(/^"([^"]+)"/);
      if (match) {
        installLocation = path.dirname(match[1]);
      }
    }

    const displayVersion = displayVersionRaw && displayVersionRaw.length > 0 ? displayVersionRaw : null;
    return { installLocation, displayVersion };
  } catch {
    return { installLocation: null, displayVersion: null };
  }
}

function candidateInstallDirs(): string[] {
  const programFileDirs = [
    process.env['ProgramFiles'] || 'C:\\Program Files',
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  ];
  const candidates = programFileDirs.map((base) => path.join(base, PRODUCT_NAME));

  // NSIS per-user install default (electron-builder when `perMachine` is not set).
  if (process.env['LocalAppData']) {
    candidates.push(path.join(process.env['LocalAppData'], 'Programs', PRODUCT_NAME));
  }

  return candidates;
}

export function discoverAppInstall(explicitInstallDir?: string): AppInstall {
  let installDir: string | null = explicitInstallDir || null;
  let installedVersion: string | null = null;

  if (!installDir) {
    const registryInfo = queryRegistryInstallInfo();
    if (registryInfo.installLocation && fs.existsSync(registryInfo.installLocation)) {
      installDir = registryInfo.installLocation.replace(/\\$/, '');
      installedVersion = registryInfo.displayVersion;
    }
  }

  if (!installDir) {
    for (const candidate of candidateInstallDirs()) {
      if (fs.existsSync(candidate)) {
        installDir = candidate;
        break;
      }
    }
  }

  if (!installDir || !fs.existsSync(installDir)) {
    throw new Error(
      `Could not locate the "${PRODUCT_NAME}" install directory (checked Windows registry uninstall ` +
        `entries and default Program Files locations). Pass --install-dir explicitly.`
    );
  }

  const resourcesPath = path.join(installDir, 'resources');
  const backendDir = path.join(resourcesPath, 'backend');
  const uploadsDir = path.join(backendDir, 'uploads', 'products');
  const migrateScriptPath = path.join(backendDir, 'dist', 'scripts', 'migrate.js');
  const migrationsDir = path.join(resourcesPath, 'database', 'migrations');

  const exeCandidates = fs.existsSync(installDir)
    ? fs.readdirSync(installDir).filter((f) => f.toLowerCase().endsWith('.exe'))
    : [];
  const exePath = exeCandidates.length > 0 ? path.join(installDir, exeCandidates[0]) : null;

  return {
    installDir,
    exePath,
    resourcesPath,
    backendDir,
    uploadsDir,
    migrateScriptPath,
    migrationsDir,
    installedVersion,
  };
}
