import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';

// Better environment detection - use app.isPackaged for reliable detection
// Also check if built frontend exists - if it does, prefer production mode
const builtFrontendPath = path.join(__dirname, '../frontend/dist/index.html');
const hasBuiltFrontend = fs.existsSync(builtFrontendPath);

const isDev = (process.env.NODE_ENV === 'development' || 
              process.env.ELECTRON_IS_DEV === 'true') &&
              !hasBuiltFrontend && !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

// Function to get backend paths based on dev/production
function getBackendPaths() {
  if (isDev) {
    return {
      serverPath: path.join(__dirname, '../../backend/dist/server.js'),
      nodeModulesPath: path.join(__dirname, '../../backend/node_modules'),
      backendDir: path.join(__dirname, '../../backend'),
    };
  } else {
    // In production, files are in resourcesPath
    const resourcesPath = process.resourcesPath || app.getAppPath();
    return {
      serverPath: path.join(resourcesPath, 'backend/dist/server.js'),
      nodeModulesPath: path.join(resourcesPath, 'backend/node_modules'),
      backendDir: path.join(resourcesPath, 'backend'),
    };
  }
}

// Function to get .env file path
function getEnvPath(): string | null {
  if (isDev) {
    const devEnvPath = path.join(__dirname, '../../.env');
    return fs.existsSync(devEnvPath) ? devEnvPath : null;
  } else {
    // In production, look for .env in installation directory (same as app)
    const appPath = app.getAppPath();
    const envPath = path.join(path.dirname(appPath), '.env');
    
    // Also check resources path
    const resourcesEnvPath = path.join(process.resourcesPath || appPath, '.env');
    
    if (fs.existsSync(envPath)) {
      return envPath;
    } else if (fs.existsSync(resourcesEnvPath)) {
      return resourcesEnvPath;
    }
    
    // Return path where .env should be created (installation directory)
    return envPath;
  }
}

// Start backend server
function startBackendServer(): void {
  const { serverPath, nodeModulesPath, backendDir } = getBackendPaths();
  
  // Check if backend file exists
  if (!fs.existsSync(serverPath)) {
    console.error(`❌ Backend server not found at: ${serverPath}`);
    return;
  }

  // Check if node_modules exists
  if (!fs.existsSync(nodeModulesPath)) {
    console.error(`❌ Backend node_modules not found at: ${nodeModulesPath}`);
    return;
  }

  // Get .env path
  const envPath = getEnvPath();
  
  // Build environment variables
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3001',
    API_PORT: '3001',
    ELECTRON_IS_DEV: 'false',
    // Set NODE_PATH so Node.js can find modules
    NODE_PATH: nodeModulesPath,
    // Add node_modules to PATH for native modules
    PATH: `${nodeModulesPath}/.bin${path.delimiter}${process.env.PATH || ''}`,
  };

  // Load .env file if it exists
  if (envPath && fs.existsSync(envPath)) {
    console.log(`📄 Loading .env from: ${envPath}`);
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmedLine.substring(0, equalIndex).trim();
          let value = trimmedLine.substring(equalIndex + 1).trim();
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          env[key] = value;
        }
      }
    });
  } else {
    console.warn(`⚠️  .env file not found. Expected at: ${envPath || 'unknown'}`);
    console.warn('   Backend will use default environment variables.');
  }

  console.log(`🚀 Starting backend server from: ${serverPath}`);
  console.log(`📦 Using node_modules from: ${nodeModulesPath}`);
  
  // Use the Node.js executable that's running Electron
  const nodeExecutable = process.execPath;
  
  backendProcess = spawn(nodeExecutable, [serverPath], {
    env,
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  backendProcess.stdout?.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.log(`[Backend] ${output}`);
    }
  });

  backendProcess.stderr?.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.error(`[Backend Error] ${output}`);
    }
  });

  backendProcess.on('error', (error) => {
    console.error('❌ Failed to start backend server:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend:error', error.message);
    }
  });

  backendProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ Backend server exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend:exit', { code, signal });
      }
      // Don't auto-restart in production to avoid infinite loops
    } else {
      console.log('✅ Backend server stopped gracefully');
    }
  });

  // Wait a moment to check if server started successfully
  setTimeout(() => {
    if (backendProcess && backendProcess.killed) {
      console.error('❌ Backend process was killed immediately after start');
    }
  }, 1000);
}

// Stop backend server
function stopBackendServer(): void {
  if (backendProcess) {
    console.log('🛑 Stopping backend server...');
    try {
      if (process.platform === 'win32') {
        // On Windows, kill the process tree
        spawn('taskkill', ['/pid', backendProcess.pid!.toString(), '/f', '/t'], {
          stdio: 'ignore',
          shell: true,
        });
      } else {
        backendProcess.kill('SIGTERM');
      }
    } catch (error) {
      console.error('Error stopping backend:', error);
    }
    backendProcess = null;
  }
}

function createWindow(): void {
  // Get preload script path
  const preloadPath = path.join(__dirname, 'preload.js');

  // Get icon path - works for both dev and production
  // Use .ico for Windows, .png for other platforms
  const iconExtension = process.platform === 'win32' ? 'ico' : 'png';
  const iconPath = isDev
    ? path.join(__dirname, `../../frontend/public/icon.${iconExtension}`)
    : path.join(process.resourcesPath || app.getAppPath(), `frontend/public/icon.${iconExtension}`);

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
    // Use proper path resolution for packaged apps
    let indexPath: string;
    if (app.isPackaged) {
      // When packaged, files are in app.asar or resources path
      indexPath = path.join(process.resourcesPath || app.getAppPath(), 'frontend/dist/index.html');
    } else {
      // When not packaged (development build testing)
      indexPath = path.join(__dirname, '../frontend/dist/index.html');
    }
    
    // Check if built files exist
    if (!fs.existsSync(indexPath)) {
      console.error('❌ Built frontend not found. Please run "npm run build" first.');
      console.error(`   Expected at: ${indexPath}`);
      console.error('   Or use "npm run dev" for development mode.');
      return;
    }
    
    // Use loadFile() instead of loadURL() with file:// protocol
    // loadFile() properly handles app.asar paths and is the recommended way
    mainWindow.loadFile(indexPath).catch((err: Error) => {
      console.error('Failed to load frontend:', err);
    });
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
  // Start backend server first (only in production)
  if (!isDev) {
    console.log('🚀 Starting backend server...');
    startBackendServer();
    // Wait a bit for backend to start before showing window
    setTimeout(() => {
      createWindow();
    }, 2000);
  } else {
    // In dev mode, backend is started separately
    createWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Handle system sleep/wake events
app.on('ready', () => {
  // Notify renderer when app becomes ready (useful after wake from sleep)
  if (mainWindow) {
    mainWindow.webContents.send('app:ready');
  }
});

// Handle power state changes (sleep/wake)
const powerSaveBlocker = require('electron').powerSaveBlocker;
let powerSaveBlockerId: number | null = null;

// Prevent system sleep during active use (optional - can be enabled for long sessions)
// Uncomment if you want to prevent sleep during active POS usage
// powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');

app.on('window-all-closed', () => {
  stopBackendServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendServer();
});

// IPC handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPlatform', () => {
  return process.platform;
});

ipcMain.handle('app:getEnvPath', () => {
  return getEnvPath();
});

