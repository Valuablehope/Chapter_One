const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const bootstrap = require('./bootstrap');
const updateManager = require('../updater/updateManager');
const logger = require('../config/logger');

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // Preload if needed
    }
  });

  // Load the frontend (assuming it runs on a local port from the backend or static files)
  // For production, this could be mainWindow.loadFile(path.join(__dirname, '../frontend/build/index.html'));
  // Here we assume the backend serves something entirely or we load the static dist.
  // We'll load a standard placeholder or the backend URL.
  const backendPort = process.env.PORT || 3000;
  try {
    // If frontend is served by the backend
    await mainWindow.loadURL(`http://localhost:${backendPort}`);
  } catch (err) {
    logger.error('Failed to load frontend', { error: err.message });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  try {
    logger.info('Electron app ready, starting bootstrap flow...');
    
    // 1. Run bootstrap (config, logging, db, migrations, backend)
    await bootstrap.init();
    
    // 2. Start UI
    await createWindow();

    // 3. Init auto-updater (async, non-blocking)
    updateManager.init(mainWindow).catch((err) => {
      logger.error('Update manager init failed (offline/error)', { error: err.message });
      // We don't block the app if updates fail due to offline
    });
    
  } catch (error) {
    logger.error('Fatal error during startup bootstrap', { error: error.message, stack: error.stack });
    dialog.showErrorBox('Startup Error', `The application failed to start correctly:\n\n${error.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('quit', async () => {
  logger.info('App shutting down, cleaning up...');
  await bootstrap.shutdown();
});
