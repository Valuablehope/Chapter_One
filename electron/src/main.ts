import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as url from 'url';

// Better environment detection - use app.isPackaged for reliable detection
const isDev = process.env.NODE_ENV === 'development' || 
              process.env.ELECTRON_IS_DEV === 'true' ||
              !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Get preload script path
  const preloadPath = path.join(__dirname, 'preload.js');

  // Get icon path - works for both dev and production
  const iconPath = isDev
    ? path.join(__dirname, '../../frontend/public/icon.png')
    : path.join(__dirname, '../frontend/public/icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: iconPath, // Set window/taskbar icon
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: true,
    },
    titleBarStyle: 'default',
    show: false, // Don't show until ready
  });

  // Load the app
  if (isDev) {
    // Development: Load from Vite dev server
    console.log('🔧 Development mode: Loading from http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173').catch((err: Error) => {
      console.error('Failed to load frontend:', err);
    });
  } else {
    // Production: Load from built files
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, '../frontend/dist/index.html'),
        protocol: 'file:',
        slashes: true,
      })
    );
  }

  // Show window when ready and maximize it
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.maximize(); // Maximize window on startup
    
    // Open dev tools in development
    if (isDev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle navigation errors
  mainWindow.webContents.on('did-fail-load', (_event: unknown, errorCode: number, errorDescription: string) => {
    console.error('Failed to load:', errorCode, errorDescription);
    if (isDev) {
      // In dev, try to reload after a delay if Vite server isn't ready
      console.log('Retrying to load from Vite dev server in 2 seconds...');
      setTimeout(() => {
        mainWindow?.loadURL('http://localhost:5173').catch((err: Error) => {
          console.error('Retry failed:', err);
        });
      }, 2000);
    }
  });
}

// App event handlers
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPlatform', () => {
  return process.platform;
});

