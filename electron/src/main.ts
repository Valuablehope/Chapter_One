import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs';
import log from 'electron-log';
import { closeCustomerDisplayPort, showCustomerDisplay } from './customerDisplay';
require('dotenv').config();
import { setupIpcHandlers } from './setupHandler';

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
let appDbConfig: Record<string, string> | null = null;
const BACKEND_HEALTH_URL = 'http://127.0.0.1:3001/health';

function showStartupErrorAndQuit(title: string, message: string): void {
  log.error(`${title}: ${message}`);
  dialog.showErrorBox(title, message);
  app.quit();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface HealthResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
}

function checkBackendHealth(): Promise<HealthResult> {
  return new Promise((resolve) => {
    const request = http.get(BACKEND_HEALTH_URL, (response) => {
      response.resume();
      // 200 = healthy, 503 = server up but database disconnected
      resolve({
        ok: response.statusCode === 200 || response.statusCode === 503,
        statusCode: response.statusCode,
      });
    });

    request.on('error', (err) => resolve({ ok: false, error: err.message }));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve({ ok: false, error: 'Timeout' });
    });
  });
}

async function waitForBackendReady(timeoutMs = 45000, pollMs = 500): Promise<HealthResult> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!backendProcess || backendProcess.killed) {
      return { ok: false, error: 'Backend process died' };
    }

    const result = await checkBackendHealth();
    if (result.ok) {
      return result;
    }

    await delay(pollMs);
  }

  return { ok: false, error: 'Timeout waiting for backend' };
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

export function isSetupComplete(envPath: string | null): boolean {
  if (!envPath || !fs.existsSync(envPath)) return false;
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    // Simple check: if DB_HOST is defined, we assume setup is complete.
    // This allows manual .env edits to bypass setup too.
    return content.includes('DB_HOST=') || content.includes('DATABASE_URL=') || content.includes('SETUP_COMPLETED=true');
  } catch {
    return false;
  }
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

// Builds the complete environment variable object that both the migration subprocess
// and the backend server process need. Calling this once and sharing the result
// avoids parsing the .env file multiple times on startup.
function buildBackendEnv(envPath: string | null): NodeJS.ProcessEnv {
  const { nodeModulesPath } = getBackendPaths();

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3001',
    API_PORT: '3001',
    ELECTRON_IS_DEV: 'false',
    ELECTRON_RUN_AS_NODE: '1',
    RESOURCES_PATH: resourcesPath,
    NODE_PATH: nodeModulesPath,
    PATH: `${nodeModulesPath}/.bin${path.delimiter}${process.env.PATH || ''}`,
    USER_DATA_PATH: app.getPath('userData'),
  };

  if (envPath && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmedLine.substring(0, equalIndex).trim();
          let value = trimmedLine.substring(equalIndex + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          env[key] = value;
        }
      }
    });
  }

  persistMissingSecrets(envPath, env);
  return env;
}

// Extracts the subset of env vars needed to connect to the database, used by
// the backup module so it can reach PostgreSQL with the same credentials the
// backend uses.
function extractDbConfig(env: NodeJS.ProcessEnv): Record<string, string> {
  return {
    host: env.DB_HOST || 'localhost',
    port: env.DB_PORT || '5432',
    user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || '',
    connectionString: env.DATABASE_URL || '',
  };
}

// Spawns the backend's compiled migration script as a one-shot subprocess so
// that pending SQL migrations run against the live database before the backend
// server starts. Rejects on non-zero exit, which causes startup to abort.
async function runMigrationsOnStartup(env: NodeJS.ProcessEnv): Promise<void> {
  const { backendDir } = getBackendPaths();
  const migrateScript = path.join(backendDir, 'dist/scripts/migrate.js');

  if (!fs.existsSync(migrateScript)) {
    log.warn(`[Migration] Script not found at: ${migrateScript} — skipping.`);
    return;
  }

  log.info(`[Migration] Running migrations from: ${migrateScript}`);

  return new Promise((resolve, reject) => {
    const migrationProcess = spawn(process.execPath, [migrateScript], {
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    migrationProcess.stdout?.on('data', (data: Buffer) => {
      data.toString().trim().split('\n').forEach((line: string) => {
        if (line.trim()) log.info(`[Migration] ${line.trim()}`);
      });
    });

    migrationProcess.stderr?.on('data', (data: Buffer) => {
      data.toString().trim().split('\n').forEach((line: string) => {
        if (line.trim()) log.error(`[Migration] ${line.trim()}`);
      });
    });

    migrationProcess.on('error', (err: Error) => {
      reject(new Error(`Migration process error: ${err.message}`));
    });

    migrationProcess.on('close', (code: number | null) => {
      if (code === 0) {
        log.info('[Migration] All migrations completed successfully.');
        resolve();
      } else {
        reject(new Error(`Migration process exited with code ${code}.`));
      }
    });
  });
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

  const envPath = getEnvPath();
  const env = buildBackendEnv(envPath);

  if (!envPath || !fs.existsSync(envPath)) {
    console.warn(`⚠️  .env file not found. Expected at: ${envPath || 'unknown'}`);
    console.warn('   Backend will use default environment variables.');
  }

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

function createWindow(isSetupMode = false): void {
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
    const url = isSetupMode ? 'http://127.0.0.1:5173/#/setup' : 'http://127.0.0.1:5173';
    mainWindow.loadURL(url).catch((err: Error) => {
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
    const hash = isSetupMode ? '#/setup' : '';
    mainWindow.loadFile(indexPath, { hash }).catch((err: Error) => {
      log.error('Failed to load frontend:', err);
    });
  }

  // Show window when ready and maximize it
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.maximize(); // Maximize window on startup
    mainWindow?.focus();    // Explicitly transfer OS keyboard focus — without this,
                            // maximize() on Windows does not guarantee input focus,
                            // leaving inputs frozen until the user clicks the window.

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
  // Register setup IPC handlers
  setupIpcHandlers(app, getEnvPath, startBackendServer);

  const envPath = getEnvPath();
  const setupComplete = isSetupComplete(envPath);

  // Start backend server first (only in production)
  if (!isDev) {
    if (!setupComplete) {
      log.info('⚠️ App requires setup. Starting in setup mode...');
      createWindow(true);
      setupApplicationMenu();
      return;
    }

    // Build env once so both the migration subprocess and the backup module share
    // the same parsed credentials without re-reading the .env file.
    const startupEnvPath = getEnvPath();
    const startupEnv = buildBackendEnv(startupEnvPath);
    appDbConfig = extractDbConfig(startupEnv);

    log.info('🗄️ Running database migrations...');
    try {
      await runMigrationsOnStartup(startupEnv);
    } catch (err: any) {
      showStartupErrorAndQuit(
        'Database Migration Failed',
        `A database migration could not be applied and the application cannot start safely.\n\n${err.message}\n\nPlease restore from a backup or contact support.`
      );
      return;
    }

    log.info('🚀 Starting backend server...');
    const backendStarted = startBackendServer();
    if (!backendStarted) {
      return;
    }

    const health = await waitForBackendReady();
    if (!health.ok) {
      const detail = health.error || `Unable to reach ${BACKEND_HEALTH_URL} after startup.`;
      showStartupErrorAndQuit(
        'Backend Unavailable',
        `${detail}\n\nPlease check the application logs and verify your installation integrity.`
      );
      return;
    }

    // If backend is up but database is disconnected (503), ask user if they want to re-run setup
    if (health.statusCode === 503) {
      log.warn('⚠️ Backend is running but database is disconnected.');
      const choice = dialog.showMessageBoxSync({
        type: 'warning',
        title: 'Database Connection Failed',
        message: 'The application is configured but cannot connect to the database.',
        detail: 'This often happens if PostgreSQL was uninstalled or the connection settings changed. Would you like to re-run the Setup Wizard or try to start anyway?',
        buttons: ['Re-run Setup Wizard', 'Try Anyway', 'Exit'],
        defaultId: 0,
        cancelId: 2,
      });

      if (choice === 0) {
        log.info('User chose to re-run setup wizard.');
        createWindow(true); // Open in setup mode
        setupApplicationMenu();
        return;
      } else if (choice === 2) {
        app.quit();
        return;
      }
    }

    createWindow();
    setupApplicationMenu();
    require(path.join(app.getAppPath(), 'updater/updateManager.js'))
      .init(mainWindow, appDbConfig, app.getPath('desktop'))
      .catch((err: any) => log.error('Update manager init failed:', err));
  } else {
    // In dev mode, backend is started separately
    createWindow(!setupComplete);
    setupApplicationMenu();
    const updaterPath = isDev
      ? path.join(app.getAppPath(), '..', 'updater/updateManager.js')
      : path.join(app.getAppPath(), 'updater/updateManager.js');
    require(updaterPath)
      .init(mainWindow, appDbConfig, app.getPath('desktop'))
      .catch((err: any) => log.error('Update manager init failed:', err));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const currentSetupComplete = isSetupComplete(getEnvPath());
      createWindow(!isDev && !currentSetupComplete);
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
  closeCustomerDisplayPort();
  stopBackendServer();
});

// IPC handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:installUpdate', async () => {
  const updaterPath = isDev
    ? path.join(app.getAppPath(), '..', 'updater/updateManager.js')
    : path.join(app.getAppPath(), 'updater/updateManager.js');
  await require(updaterPath).backupAndInstall();
});

ipcMain.handle('app:getUpdateStatus', () => {
  const updaterPath = isDev
    ? path.join(app.getAppPath(), '..', 'updater/updateManager.js')
    : path.join(app.getAppPath(), 'updater/updateManager.js');
  return require(updaterPath).getLastStatus();
});

ipcMain.handle('app:getPlatform', () => {
  return process.platform;
});

ipcMain.handle('app:getEnvPath', () => {
  return getEnvPath();
});

ipcMain.handle('app:resetSetup', async () => {
  const envPath = getEnvPath();
  const choice = dialog.showMessageBoxSync({
    type: 'warning',
    title: 'Reset Configuration',
    message: 'Are you sure you want to reset the application configuration?',
    detail: 'This will delete your database connection settings and restart the Setup Wizard. Your actual database data will not be deleted.',
    buttons: ['Reset and Restart', 'Cancel'],
    defaultId: 1,
  });

  if (choice === 0) {
    log.info('Resetting setup configuration...');
    try {
      // Delete .env from all possible locations
      const locations = [
        envPath,
        path.join(app.getPath('userData'), '.env'),
        path.join(path.dirname(app.getPath('exe')), '.env')
      ].filter(p => p && fs.existsSync(p)) as string[];

      locations.forEach(p => {
        try {
          fs.unlinkSync(p);
          log.info(`Deleted config: ${p}`);
        } catch (e) {
          log.error(`Failed to delete ${p}:`, e);
        }
      });

      app.relaunch();
      app.exit(0);
    } catch (error) {
      log.error('Failed to reset setup:', error);
      return { success: false, error: (error as Error).message };
    }
  }
  return { success: false };
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

ipcMain.handle('app:getPrinters', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    return await win.webContents.getPrintersAsync();
  }
  return [];
});

ipcMain.handle('app:print-silent', async (event, deviceName?: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    return new Promise((resolve) => {
      const options: Electron.WebContentsPrintOptions = { 
        silent: true, 
        printBackground: true 
      };
      
      if (deviceName) {
        options.deviceName = deviceName;
      }

      win.webContents.print(options, (success, failureReason) => {
        if (!success) {
          log.error('Silent print failed:', failureReason);
          resolve({ success: false, error: failureReason });
        } else {
          resolve({ success: true });
        }
      });
    });
  }
  return { success: false, error: 'No window found' };
});

ipcMain.handle(
  'customer-display:show',
  async (_event, payload: { storeName: string; amount: number }) => {
    try {
      if (!payload || typeof payload.amount !== 'number' || !Number.isFinite(payload.amount)) {
        return { ok: false as const };
      }
      const name = typeof payload.storeName === 'string' ? payload.storeName : '';
      await showCustomerDisplay(name, payload.amount);
      return { ok: true as const };
    } catch (e) {
      log.error('[customer-display:show]', e);
      return { ok: false as const };
    }
  }
);

// Catch unhandled exceptions
process.on('uncaughtException', (error) => {
  log.error('Main Process Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('Main Process Unhandled Rejection:', reason);
});

