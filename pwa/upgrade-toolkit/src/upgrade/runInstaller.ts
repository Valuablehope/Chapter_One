import * as fs from 'fs';
import { runCommand } from '../util/runCommand';
import { discoverAppInstall } from '../config/discoverAppInstall';
import { Logger } from '../logging/logger';

// NSIS installers built by electron-builder support the standard `/S` silent
// flag — the same one electron-updater's own quitAndInstall() uses
// internally (docs/remote-update.md, Step 11), so this reuses a proven
// mechanism rather than inventing a new install path.
export async function runInstallerSilently(installerPath: string, expectedVersion: string | undefined, logger: Logger): Promise<void> {
  if (!fs.existsSync(installerPath)) {
    throw new Error(`Installer not found at: ${installerPath}`);
  }

  logger.info(`Running installer silently: ${installerPath}`);
  const result = await runCommand(installerPath, ['/S'], { timeoutMs: 10 * 60 * 1000 });

  if (!result.success) {
    throw new Error(`Installer exited with an error: ${result.error}`);
  }

  logger.info('Installer process completed. Verifying installed version...');
  const appInstall = discoverAppInstall();
  logger.info(`Installed version now reports: ${appInstall.installedVersion ?? 'unknown'}`);

  if (expectedVersion && appInstall.installedVersion && appInstall.installedVersion !== expectedVersion) {
    throw new Error(
      `Expected installed version ${expectedVersion} after running the installer, but the registry reports ` +
        `${appInstall.installedVersion}. Verify manually before proceeding to migrate.`
    );
  }
}
