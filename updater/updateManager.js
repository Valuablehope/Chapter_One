const { autoUpdater } = require('electron-updater');
const logger = require('../config/logger');

let mainWindowRef = null;
let lastStatus = { status: 'checking' };
let appDbConfig = null;
let appDesktopPath = null;

function emitStatus(status, payload = {}) {
  lastStatus = { status, ...payload };
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('updater:status', lastStatus);
  }
}

function getLastStatus() {
  return lastStatus;
}

/**
 * @param {Electron.BrowserWindow} mainWindow
 * @param {object} dbConfig  { host, port, user, password, database, connectionString? }
 * @param {string} desktopPath  Absolute path to the user's Desktop directory.
 */
async function init(mainWindow, dbConfig, desktopPath) {
  logger.info('Initializing GitHub Update Manager...');
  mainWindowRef = mainWindow;
  appDbConfig = dbConfig;
  appDesktopPath = desktopPath;

  autoUpdater.logger = logger;
  autoUpdater.autoDownload = true;
  // Disabled so the app never installs silently on quit without first creating a backup.
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    logger.info('checking-for-update: Communicating with GitHub Releases...');
    emitStatus('checking');
  });

  autoUpdater.on('update-available', (info) => {
    logger.info(`update-available: Version ${info.version} identified on GitHub.`);
    emitStatus('downloading', { percent: 0, version: info.version });
  });

  autoUpdater.on('update-not-available', (info) => {
    logger.info(`update-not-available: Current version ${info.version} is up to date.`);
    emitStatus('up-to-date', { version: info.version });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    logger.debug(`download-progress: ${Math.round(progressObj.percent)}% (${progressObj.bytesPerSecond} bps)`);
    emitStatus('downloading', { percent: progressObj.percent, speed: progressObj.bytesPerSecond });
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info(`update-downloaded: Version ${info.version} cached successfully.`);
    emitStatus('ready', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    logger.error('Update sequence failed.', { error: err.message, stack: err.stack });
    emitStatus('error', { error: err.message });
  });

  try {
    const { app } = require('electron');
    if (!app.isPackaged) {
      logger.info('Skipping update check: application is running in development mode.');
      emitStatus('up-to-date', { version: app.getVersion() });
      return;
    }

    const isOnline = await checkInternetConnection();
    if (isOnline) {
      logger.info('Internet connection verified. Initiating background checkForUpdates.');
      await autoUpdater.checkForUpdates();
    } else {
      logger.warn('Skipping update check: no active internet connection.');
    }
  } catch (err) {
    logger.error('Failed to trigger update check.', { error: err.message });
    emitStatus('error', { error: err.message });
  }

  setInterval(async () => {
    if (!require('electron').app.isPackaged) return;
    const online = await checkInternetConnection();
    if (online) {
      autoUpdater.checkForUpdates().catch(e => logger.error('Interval update check failed.', e));
    }
  }, 6 * 60 * 60 * 1000);
}

/**
 * Creates a database backup on the client's Desktop, then installs the downloaded
 * update. Called by the app:installUpdate IPC handler. Backup failure is non-fatal
 * — the update proceeds regardless to avoid leaving clients on a broken version.
 */
async function backupAndInstall() {
  logger.info('User triggered update install. Starting pre-update backup...');

  if (appDbConfig && appDesktopPath) {
    emitStatus('backing-up');
    try {
      const { createBackup } = require('./dbBackup');
      const result = await createBackup(appDbConfig, appDesktopPath);

      if (result.success) {
        logger.info(`Pre-update backup saved to: ${result.backupPath}`);
        emitStatus('backup-done', { backupPath: result.backupPath });
      } else {
        logger.warn(`Backup skipped: ${result.error}`);
        emitStatus('backup-skipped', { error: result.error });
      }
    } catch (err) {
      logger.error('Backup threw an unexpected error.', { error: err.message });
      emitStatus('backup-skipped', { error: err.message });
    }

    // Brief pause so the UI can render the backup status before the process quits.
    await new Promise(r => setTimeout(r, 1500));
  } else {
    logger.warn('DB config or desktop path not available — backup skipped.');
  }

  logger.info('Proceeding with quitAndInstall.');
  autoUpdater.quitAndInstall();
}

function checkInternetConnection() {
  return new Promise((resolve) => {
    require('dns').resolve('github.com', (err) => resolve(!err));
  });
}

module.exports = { init, backupAndInstall, getLastStatus };
