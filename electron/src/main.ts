import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs';
import log from 'electron-log';
require('dotenv').config();

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'info';

// Set log file name and format
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.file.fileName = 'application.log';

// Log where the log file is located
console.log('Log file located at:', log.transports.file.getFile().path);

// Log startup information
log.info('--- Application starting ---');
log.info('Version:', app.getVersion());
log.info('Platform:', process.platform);
log.info('Process ID:', process.pid);

// Better environment detection
const isDev = process.env.ELECTRON_IS_DEV === 'true' || (!app.isPackaged && process.env.NODE_ENV !== 'production');
const isProduction = !isDev;
const appPath = app.getAppPath();
const resourcesPath = process.resourcesPath;

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
const BACKEND_HEALTH_URL = 'http://127.0.0.1:3001/health';

function showStartupErrorAndQuit(title: string, message: string): void {
  log.error(`${title}: ${message}`);
  dialog.showErrorBox(title, message);
  app.quit();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkBackendHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(BACKEND_HEALTH_URL, (response) => {
      response.resume();
      // Allow 503 Service Unavailable because it means the HTTP server is up, 
      // even if the database connection isn't ready.
      resolve(response.statusCode === 200 || response.statusCode === 503);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForBackendReady(timeoutMs = 45000, pollMs = 500): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!backendProcess || backendProcess.killed) {
      return false;
    }

    const healthy = await checkBackendHealth();
    if (healthy) {
      return true;
    }

    await delay(pollMs);
  }

  return false;
}

// Function to get backend paths based on dev/production
function getBackendPaths() {
  // If we are not packaged, we are running from source (either dev or npm start)
  if (!app.isPackaged) {
    return {
      serverPath: path.join(appPath, 'backend/dist/server.js'),
      nodeModulesPath: path.join(appPath, 'node_modules'),
      backendDir: path.join(appPath, 'backend'),
    };
  } else {
    // In production, backend is in resources/backend
    const backendRoot = path.join(process.resourcesPath, 'backend');
    return {
      serverPath: path.join(backendRoot, 'dist/server.js'),
      nodeModulesPath: path.join(backendRoot, 'node_modules'),
      backendDir: backendRoot,
    };
  }
}

// Function to get .env file path
function getEnvPath(): string | null {
  // 1. If we are running from source (not packaged), always look in project root
  if (!app.isPackaged) {
    const rootEnvPath = path.join(appPath, '.env');
    if (fs.existsSync(rootEnvPath)) return rootEnvPath;
    return null;
  }

  // 2. In packaged production, prefer userData/.env for persistence across auto-updates
  const userDataEnvPath = path.join(app.getPath('userData'), '.env');
  const installDir = path.dirname(app.getPath('exe'));
  const envPath = path.join(installDir, '.env');
  const resourcesEnvPath = path.join(resourcesPath, '.env');

  if (fs.existsSync(userDataEnvPath)) {
    return userDataEnvPath;
  }

  if (fs.existsSync(envPath)) {
    return envPath;
  } else if (fs.existsSync(resourcesEnvPath)) {
    return resourcesEnvPath;
  }

  return envPath;
}

function generateSecret(minLength = 32): string {
  const raw = crypto.randomBytes(48).toString('hex');
  return raw.length >= minLength ? raw : `${raw}${crypto.randomBytes(16).toString('hex')}`;
}

function ensureUserDataEnvFile(sourceEnvPath: string | null): string {
  const userDataEnvPath = path.join(app.getPath('userData'), '.env');
  const userDataDir = path.dirname(userDataEnvPath);

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  if (!fs.existsSync(userDataEnvPath) && sourceEnvPath && fs.existsSync(sourceEnvPath)) {
    try {
      fs.copyFileSync(sourceEnvPath, userDataEnvPath);
      log.info(`Copied .env to userData for update-safe persistence: ${userDataEnvPath}`);
    } catch (error) {
      log.warn(`Unable to copy .env to userData: ${(error as Error).message}`);
    }
  }

  if (!fs.existsSync(userDataEnvPath)) {
    fs.writeFileSync(userDataEnvPath, '', 'utf-8');
  }

  return userDataEnvPath;
}

function persistMissingSecrets(envPath: string | null, envVars: NodeJS.ProcessEnv): void {
  if (!app.isPackaged) {
    return;
  }

  const userDataEnvPath = ensureUserDataEnvFile(envPath);
  const existingContent = fs.existsSync(userDataEnvPath)
    ? fs.readFileSync(userDataEnvPath, 'utf-8')
    : '';
  let updatedContent = existingContent;

  const upsertLine = (key: string, value: string) => {
    const lineRegex = new RegExp(`^[\\t ]*${key}[\\t ]*=.*$`, 'm');
    const line = `${key}=${value}`;

    if (lineRegex.test(updatedContent)) {
      updatedContent = updatedContent.replace(lineRegex, line);
      return;
    }

    const separator = updatedContent.endsWith('\n') || updatedContent.length === 0 ? '' : '\n';
    updatedContent = `${updatedContent}${separator}${line}\n`;
  };

  if (!envVars.JWT_SECRET || envVars.JWT_SECRET.trim().length < 32) {
    envVars.JWT_SECRET = generateSecret(32);
    upsertLine('JWT_SECRET', envVars.JWT_SECRET);
  }

  if (!envVars.LICENSE_ENCRYPTION_KEY || envVars.LICENSE_ENCRYPTION_KEY.trim().length < 32) {
    envVars.LICENSE_ENCRYPTION_KEY = generateSecret(32);
    upsertLine('LICENSE_ENCRYPTION_KEY', envVars.LICENSE_ENCRYPTION_KEY);
  }

  if (updatedContent !== existingContent) {
    fs.writeFileSync(userDataEnvPath, updatedContent, 'utf-8');
    log.warn(`Persisted missing secrets to: ${userDataEnvPath}`);
  }
}

// Start backend server
function startBackendServer(): boolean {
  const { serverPath, nodeModulesPath, backendDir } = getBackendPaths();

  // Check if backend file exists
  if (!fs.existsSync(serverPath)) {
    showStartupErrorAndQuit(
      'Backend Startup Error',
      `Backend server not found at:\n${serverPath}\n\nPlease reinstall the application to restore missing files.`
    );
    return false;
  }

  // Check if node_modules exists
  if (!fs.existsSync(nodeModulesPath)) {
    log.error(`❌ Backend node_modules not found at: ${nodeModulesPath}`);

    // Debug info: List contents of backend directory
    if (fs.existsSync(backendDir)) {
      try {
        const contents = fs.readdirSync(backendDir);
        log.info(`📂 Contents of ${backendDir}:`, contents);
      } catch (e) {
        log.error('Failed to list backend dir contents', e);
      }
    } else {
      log.error(`❌ Backend directory does not exist at: ${backendDir}`);
      // Check parent directory
      const parentDir = path.dirname(backendDir);
      if (fs.existsSync(parentDir)) {
        log.info(`📂 Contents of ${parentDir}:`, fs.readdirSync(parentDir));
      }
    }

    showStartupErrorAndQuit(
      'Backend Startup Error',
      `Backend dependencies are missing at:\n${nodeModulesPath}\n\nThis installation appears incomplete. Please reinstall or run the installer again.`
    );
    return false;
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
    ELECTRON_RUN_AS_NODE: '1', // CRITICAL: Run as plain Node, not Electron
    // Pass resources path explicitly so backend doesn't have to guess relative paths
    RESOURCES_PATH: resourcesPath,
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

  persistMissingSecrets(envPath, env);

  console.log(`🚀 Starting backend server from: ${serverPath}`);
  console.log(`📦 Using node_modules from: ${nodeModulesPath}`);
  console.log(`📂 Working directory: ${backendDir}`);
  console.log(`📄 Using .env path: ${envPath || 'none'}`);

  // Use the Node.js executable that's running Electron
  const nodeExecutable = process.execPath;

  backendProcess = spawn(nodeExecutable, [serverPath], {
    env,
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  let lastError = '';

  backendProcess.stdout?.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log.info(`[Backend] ${output}`);
    }
  });

  backendProcess.stderr?.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log.error(`[Backend Error] ${output}`);
      lastError = output; // Capture last error message
    }
  });

  backendProcess.on('error', (error) => {
    console.error('❌ Failed to start backend server:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backend:error', {
        message: error.message,
        code: (error as any).code,
        type: 'startup_error',
      });
      // Show error dialog to user
      mainWindow.webContents.executeJavaScript(`
        alert('Failed to start backend server:\\n\\n${error.message.replace(/'/g, "\\'")}\\n\\nPlease check your configuration and try again.');
      `);
    }
  });

  backendProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      const errorMsg = `Backend server exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`;
      log.error(`❌ ${errorMsg}`);

      const detailedError = lastError ? `\n\nSpecific Error:\n${lastError}` : '';

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`
          alert('Backend Error: ${errorMsg}${detailedError.replace(/'/g, "\\'")}\\n\\nThe application may not function correctly.');
        `);
      } else {
        // Window not ready yet, show blocking dialog
        dialog.showErrorBox('Backend Error', `${errorMsg}${detailedError}\n\nThe application cannot start without the backend server. Please check your database configuration in the .env file and ensure PostgreSQL is running.`);
        app.quit();
      }
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

  return true;
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
  const iconExtension = process.platform === 'win32' ? 'ico' : 'png';
  let iconPath: string;

  if (isDev) {
    iconPath = path.join(appPath, `frontend/public/icon.${iconExtension}`);
  } else {
    // In production, icon is in the built/packaged location
    // Try multiple possible locations
    const possiblePaths = [
      path.join(appPath, `frontend/dist/icon.${iconExtension}`),
      path.join(appPath, `frontend/public/icon.${iconExtension}`),
      path.join(resourcesPath, `icon.${iconExtension}`)
    ];

    iconPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
  }

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
    log.info('🔧 Development mode: Loading from http://127.0.0.1:5173');
    mainWindow.loadURL('http://127.0.0.1:5173').catch((err: Error) => {
      log.error('Failed to load frontend:', err);
    });
  } else {
    // Production: Load from built files
    // Files are always in the app path (asar)
    const indexPath = path.join(appPath, 'frontend/dist/index.html');

    // Check if built files exist
    if (!fs.existsSync(indexPath)) {
      log.error('❌ Built frontend not found. Please run "npm run build" first.');
      log.error(`   Expected at: ${indexPath}`);
      log.error('   Or use "npm run dev" for development mode.');
      return;
    }

    // Use loadFile() instead of loadURL() with file:// protocol
    // loadFile() properly handles app.asar paths and is the recommended way
    mainWindow.loadFile(indexPath).catch((err: Error) => {
      log.error('Failed to load frontend:', err);
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
    log.error('Failed to load:', errorCode, errorDescription);
    if (isDev) {
      // In dev, try to reload after a delay if Vite server isn't ready
      log.info('Retrying to load from Vite dev server in 2 seconds...');
      setTimeout(() => {
        mainWindow?.loadURL('http://127.0.0.1:5173').catch((err: Error) => {
          log.error('Retry failed:', err);
        });
      }, 2000);
    } else {
      // In production, show user-friendly error
      log.error('Failed to load application files. The application may be corrupted.');
      if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`
          document.body.innerHTML = \`
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui; background: #f3f4f6;">
              <div style="text-align: center; padding: 2rem; max-width: 500px;">
                <h1 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; color: #111827;">Application Error</h1>
                <p style="color: #6b7280; margin-bottom: 1.5rem;">
                  Failed to load the application. Please restart the application or contact support if the problem persists.
                </p>
                <button onclick="location.reload()" style="padding: 0.5rem 1.5rem; background: #dc2626; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 500;">
                  Reload Application
                </button>
              </div>
            </div>
          \`;
        `);
      }
    }
  });

  // Handle uncaught exceptions in renderer
  mainWindow.webContents.on('unresponsive', () => {
    log.warn('Window became unresponsive');
    if (mainWindow) {
      const { dialog } = require('electron');
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        title: 'Application Not Responding',
        message: 'The application is not responding. Would you like to wait or reload?',
        buttons: ['Wait', 'Reload', 'Close'],
        defaultId: 0,
      });

      if (choice === 1) {
        mainWindow.reload();
      } else if (choice === 2) {
        mainWindow.close();
      }
    }
  });

  // Handle renderer process crash
  mainWindow.webContents.on('render-process-gone', (_event: any, details: any) => {
    log.error('Renderer process crashed:', details);
    if (mainWindow && details.reason !== 'killed') {
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Application Crashed',
        'The application has crashed. It will be reloaded.'
      );
      mainWindow.reload();
    }
  });
}

// App event handlers
app.whenReady().then(async () => {
  // Start backend server first (only in production)
  if (!isDev) {
    log.info('🚀 Starting backend server...');
    const backendStarted = startBackendServer();
    if (!backendStarted) {
      return;
    }

    const backendReady = await waitForBackendReady();
    if (!backendReady) {
      const detail = `Unable to reach ${BACKEND_HEALTH_URL} after startup.`;
      showStartupErrorAndQuit(
        'Backend Unavailable',
        `${detail}\n\nPlease check the application logs and verify your installation integrity.`
      );
      return;
    }

    createWindow();
    setupApplicationMenu();
    require(path.join(app.getAppPath(), 'updater/updateManager.js')).init(mainWindow).catch((err: any) => log.error('Update manager init failed:', err));
  } else {
    // In dev mode, backend is started separately
    createWindow();
    setupApplicationMenu();
    require(path.join(app.getAppPath(), 'updater/updateManager.js')).init(mainWindow).catch((err: any) => log.error('Update manager init failed:', err));
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

function setupApplicationMenu() {
  const template: any[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('app:showDocumentation');
            }
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

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

ipcMain.handle('app:installUpdate', () => {
  require(path.join(app.getAppPath(), 'updater/updateManager.js')).manualQuitAndInstall();
});

ipcMain.handle('app:getUpdateStatus', () => {
  return require(path.join(app.getAppPath(), 'updater/updateManager.js')).getLastStatus();
});

ipcMain.handle('app:getPlatform', () => {
  return process.platform;
});

ipcMain.handle('app:getEnvPath', () => {
  return getEnvPath();
});

ipcMain.on('app:log', (_event, { level, message }) => {
  const logMessage = `[Renderer] ${message}`;
  switch (level) {
    case 'error': log.error(logMessage); break;
    case 'warn': log.warn(logMessage); break;
    case 'debug': log.debug(logMessage); break;
    default: log.info(logMessage);
  }
});

ipcMain.handle('app:openLogs', () => {
  const logPath = log.transports.file.getFile().path;
  const logDir = path.dirname(logPath);
  if (fs.existsSync(logDir)) {
    require('electron').shell.openPath(logDir);
    return { success: true };
  }
  return { success: false, error: 'Log directory not found' };
});

// Catch unhandled exceptions
process.on('uncaughtException', (error) => {
  log.error('Main Process Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('Main Process Unhandled Rejection:', reason);
});

