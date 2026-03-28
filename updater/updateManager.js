const { autoUpdater } = require('electron-updater');
const logger = require('../config/logger');

// Store a reference to the main window to securely send progress if needed
let mainWindowRef = null;

function emitStatus(status, payload = {}) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('updater:status', { status, ...payload });
  }
}

async function init(mainWindow) {
  logger.info('Initializing GitHub Update Manager...');
  mainWindowRef = mainWindow;

  // Use the established logger for electron-updater output
  autoUpdater.logger = logger;
  
  // Set to download automatically in the background
  autoUpdater.autoDownload = true;
  
  // Allow Dev testing simulating the GitHub update
  autoUpdater.forceDevUpdateConfig = true;

  // Bind Native Update Lifecycle Events
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
    let log_message = `download-progress: ${Math.round(progressObj.percent)}% (${progressObj.bytesPerSecond} bps)`;
    logger.debug(log_message);
    emitStatus('downloading', { percent: progressObj.percent, speed: progressObj.bytesPerSecond });
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info(`update-downloaded: Version ${info.version} cached successfully.`);
    emitStatus('ready', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    logger.error('error: Update sequence failed.', { error: err.message, stack: err.stack });
    emitStatus('error', { error: err.message });
  });

  // Execute the update check safely
  try {
    const isOnline = await checkInternetConnection();
    if (isOnline) {
      logger.info('Internet connection verified. Initiating background checkForUpdates.');
      await autoUpdater.checkForUpdates();
    } else {
      logger.warn('Skipping update check: No active internet connection.');
    }
  } catch (err) {
    logger.error('Failed to trigger update check', { error: err.message });
  }

  setInterval(async () => {
    const online = await checkInternetConnection();
    if (online) {
      autoUpdater.checkForUpdates().catch(e => logger.error('Interval update failed', e));
    }
  }, 6 * 60 * 60 * 1000);
}

// Helper to manually quit and install if a custom UI component requests it
function manualQuitAndInstall() {
  logger.info('Application forcefully restarting to apply update.');
  autoUpdater.quitAndInstall();
}

/**
 * Basic DNS resolution check to ensure we aren't wasting time if offline.
 */
function checkInternetConnection() {
  return new Promise((resolve) => {
    require('dns').resolve('github.com', (err) => {
      resolve(!err);
    });
  });
}

module.exports = {
  init,
  manualQuitAndInstall
};
