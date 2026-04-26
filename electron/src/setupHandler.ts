import { ipcMain, app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import log from 'electron-log';
import { isSetupComplete } from './main';

export function setupIpcHandlers(
  appInstance: Electron.App,
  getEnvPath: () => string | null,
  startBackendServer: () => boolean
) {
  ipcMain.handle('setup:isComplete', () => {
    return isSetupComplete(getEnvPath());
  });

  ipcMain.handle('setup:saveConfig', async (_event, config: Record<string, string>) => {
    try {
      let envPath = getEnvPath();
      
      // CRITICAL: In production (packaged), always write to userData to avoid EPERM errors 
      // when the app is installed in Program Files.
      if (app.isPackaged) {
        envPath = path.join(appInstance.getPath('userData'), '.env');
      } else if (!envPath) {
        // Fallback for dev if getEnvPath() failed
        envPath = path.join(appInstance.getPath('userData'), '.env');
      }

      let content = '';
      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');
      }

      // Merge new config
      const lines = content.split('\n');
      const envObj: Record<string, string> = {};
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx > 0) {
            envObj[trimmed.substring(0, idx)] = trimmed.substring(idx + 1);
          }
        }
      });

      // Override with new config
      Object.assign(envObj, config);
      envObj['SETUP_COMPLETED'] = 'true';

      const newContent = Object.entries(envObj).map(([k, v]) => `${k}=${v}`).join('\n');
      
      // Ensure directory exists
      const dir = path.dirname(envPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(envPath, newContent, 'utf-8');
      log.info('Setup config saved to:', envPath);
      return { success: true };
    } catch (error) {
      log.error('Failed to save setup config:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('setup:installPostgres', async (_event, { password, port }) => {
    return new Promise(async (resolve) => {
      try {
        log.info(`Checking if PostgreSQL is already installed and running on port ${port || '5432'}...`);
        const { Client } = require('pg');
        const testClient = new Client({
          host: 'localhost',
          port: parseInt(port || '5432', 10),
          user: 'postgres',
          password: password,
          database: 'postgres'
        });

        try {
          await testClient.connect();
          await testClient.end();
          log.info('✅ PostgreSQL is already installed and accessible. Skipping installation.');
          return resolve({ success: true, skipped: true });
        } catch (e: any) {
          log.warn(`PostgreSQL connection check failed. Reason: ${e.message}`);
          log.info('Proceeding with installation...');
        }

        log.info('Looking for PostgreSQL installer...');
        let installerPath = '';
        if (app.isPackaged) {
          installerPath = path.join(process.resourcesPath, 'installers', 'postgresql-installer.exe');
        } else {
          installerPath = path.join(__dirname, '../../installers/postgresql-installer.exe');
        }

        if (!fs.existsSync(installerPath)) {
          if (!app.isPackaged) {
            log.warn(`PostgreSQL installer not found at ${installerPath}. Bypassing installation in development mode.`);
            return resolve({ success: true, skipped: true });
          }
          throw new Error(`PostgreSQL installer not found at ${installerPath}. Please place postgresql-installer.exe in the installers folder.`);
        }

        log.info(`Running PostgreSQL silent installation from: ${installerPath}`);
        
        // Execute unattended installation with UAC elevation using PowerShell
        const psCommand = `
          $process = Start-Process -FilePath '${installerPath}' -ArgumentList '--mode', 'unattended', '--unattendedmodeui', 'none', '--superpassword', '${password.replace(/'/g, "''")}', '--serverport', '${port || '5432'}' -Verb RunAs -Wait -PassThru
          if ($process) { exit $process.ExitCode } else { exit 1 }
        `;

        const pgProcess = spawn('powershell.exe', [
          '-NoProfile',
          '-ExecutionPolicy', 'Bypass',
          '-Command', psCommand
        ], {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        pgProcess.stdout?.on('data', (data) => log.info(`[PG Install] ${data.toString().trim()}`));
        pgProcess.stderr?.on('data', (data) => log.warn(`[PG Install Warn] ${data.toString().trim()}`));

        pgProcess.on('error', (err) => {
          log.error('PostgreSQL spawn error:', err);
          resolve({ success: false, error: 'Failed to launch installer: ' + err.message });
        });

        pgProcess.on('close', (code) => {
          if (code === 0) {
            log.info('PostgreSQL installed successfully.');
            resolve({ success: true });
          } else {
            log.error(`PostgreSQL installation failed with code ${code}`);
            resolve({ success: false, error: `Installation exited with code ${code}` });
          }
        });
      } catch (err: any) {
        log.error('Failed to initiate PostgreSQL install:', err);
        resolve({ success: false, error: err.message });
      }
    });
  });

  ipcMain.handle('setup:runMigrations', async (_event, { password, port }) => {
    return new Promise((resolve) => {
      try {
        log.info('Running database migrations...');
        
        // We will run the migrate script via the node executable
        let scriptPath = '';
        if (app.isPackaged) {
           scriptPath = path.join(process.resourcesPath, 'backend', 'dist', 'scripts', 'migrate.js');
        } else {
           // Use tsx in dev
           scriptPath = path.join(__dirname, '../../backend/src/scripts/migrate.ts');
        }

        const env: Record<string, string | undefined> = {
          ...process.env,
          DB_HOST: 'localhost',
          DB_PORT: port || '5432',
          DB_USER: 'postgres',
          DB_PASSWORD: password,
          DB_NAME: 'Chapter_One',
        };

        const runner = app.isPackaged ? process.execPath : path.join(__dirname, '../../node_modules/.bin/tsx.cmd');
        const runnerArgs = app.isPackaged ? [scriptPath] : [scriptPath];
        
        if (app.isPackaged) {
          // If packaged, process.execPath is Electron, we need to run it as plain node
          env['ELECTRON_RUN_AS_NODE'] = '1';
        }

        log.info(`Executing migration script: ${runner} ${runnerArgs.join(' ')}`);

        log.info(`Migration env: DB_HOST=${env.DB_HOST}, DB_PORT=${env.DB_PORT}, DB_USER=${env.DB_USER}, DB_NAME=${env.DB_NAME}`);
        log.info(`Port argument received from UI: ${port}`);

        const migrateProcess = spawn(runner, runnerArgs, { env, stdio: ['ignore', 'pipe', 'pipe'], shell: !app.isPackaged && process.platform === 'win32' });

        let errorOutput = '';

        migrateProcess.stdout?.on('data', (data) => log.info(`[Migrate] ${data.toString().trim()}`));
        migrateProcess.stderr?.on('data', (data) => {
          const msg = data.toString().trim();
          log.error(`[Migrate Error] ${msg}`);
          errorOutput += msg + '\n';
        });

        migrateProcess.on('error', (err) => {
          log.error('Migrate spawn error:', err);
          resolve({ success: false, error: 'Failed to launch migrations: ' + err.message });
        });

        migrateProcess.on('close', (code) => {
          if (code === 0) {
            log.info('Migrations executed successfully.');
            resolve({ success: true });
          } else {
            log.error(`Migrations failed with code ${code}`);
            resolve({ success: false, error: `Migrations failed: ${errorOutput}` });
          }
        });

      } catch (err: any) {
        log.error('Failed to run migrations:', err);
        resolve({ success: false, error: err.message });
      }
    });
  });

  ipcMain.handle('setup:createAdmin', async (_event, { password, port }) => {
    return new Promise((resolve) => {
      try {
        log.info('Creating default admin user...');
        
        let scriptPath = '';
        if (app.isPackaged) {
           scriptPath = path.join(process.resourcesPath, 'backend', 'dist', 'scripts', 'createTestUser.js');
        } else {
           scriptPath = path.join(__dirname, '../../backend/src/scripts/createTestUser.ts');
        }

        const env: Record<string, string | undefined> = {
          ...process.env,
          DB_HOST: 'localhost',
          DB_PORT: port || '5432',
          DB_USER: 'postgres',
          DB_PASSWORD: password,
          DB_NAME: 'Chapter_One',
        };

        const runner = app.isPackaged ? process.execPath : path.join(__dirname, '../../node_modules/.bin/tsx.cmd');
        const runnerArgs = [scriptPath, 'admin', password];
        
        if (app.isPackaged) {
          env['ELECTRON_RUN_AS_NODE'] = '1';
        }

        log.info(`Executing create-user script: ${runner} ${runnerArgs.join(' ')}`);

        const cp = spawn(runner, runnerArgs, { env, stdio: ['ignore', 'pipe', 'pipe'], shell: !app.isPackaged && process.platform === 'win32' });

        cp.on('close', (code) => {
          if (code === 0) {
            log.info('Default admin user created successfully.');
            resolve({ success: true });
          } else {
            log.error(`Failed to create admin user with code ${code}`);
            resolve({ success: false, error: `Failed to create admin user (code ${code})` });
          }
        });

      } catch (err: any) {
        log.error('Failed to create admin user:', err);
        resolve({ success: false, error: err.message });
      }
    });
  });

  ipcMain.handle('setup:initializeStore', async (_event, { storeName, password, port }) => {
    return new Promise((resolve) => {
      try {
        log.info(`Initializing store: ${storeName}...`);
        
        let scriptPath = '';
        if (app.isPackaged) {
           scriptPath = path.join(process.resourcesPath, 'backend', 'dist', 'scripts', 'initializeStore.js');
        } else {
           scriptPath = path.join(__dirname, '../../backend/src/scripts/initializeStore.ts');
        }

        const env: Record<string, string | undefined> = {
          ...process.env,
          DB_HOST: 'localhost',
          DB_PORT: port || '5432',
          DB_USER: 'postgres',
          DB_PASSWORD: password,
          DB_NAME: 'Chapter_One',
        };

        const runner = app.isPackaged ? process.execPath : path.join(__dirname, '../../node_modules/.bin/tsx.cmd');
        const runnerArgs = [scriptPath, storeName];
        
        if (app.isPackaged) {
          env['ELECTRON_RUN_AS_NODE'] = '1';
        }

        log.info(`Executing initialize-store script: ${runner} ${runnerArgs.join(' ')}`);

        const cp = spawn(runner, runnerArgs, { env, stdio: ['ignore', 'pipe', 'pipe'], shell: !app.isPackaged && process.platform === 'win32' });

        cp.on('close', (code) => {
          if (code === 0) {
            log.info('Store initialized successfully.');
            resolve({ success: true });
          } else {
            log.error(`Failed to initialize store with code ${code}`);
            resolve({ success: false, error: `Failed to initialize store (code ${code})` });
          }
        });

      } catch (err: any) {
        log.error('Failed to initialize store:', err);
        resolve({ success: false, error: err.message });
      }
    });
  });

  ipcMain.handle('setup:installService', async () => {
    return new Promise((resolve) => {
      try {
        log.info('Installing Windows Service for backend via sc.exe...');

        let scriptPath = '';
        let nodePath = '';
        if (app.isPackaged) {
          scriptPath = path.join(process.resourcesPath, 'backend', 'dist', 'server.js');
          nodePath = process.execPath; // Electron exe with ELECTRON_RUN_AS_NODE=1
        } else {
          scriptPath = path.join(__dirname, '../../backend/dist/server.js');
          nodePath = process.execPath;
        }

        const serviceName = 'ChapterOneBackend';
        const displayName = 'Chapter One Backend';
        const description = 'Node.js API server for Chapter One POS';
        const binPath = `"${nodePath}" "${scriptPath}"`;

        // Use sc.exe to create the service
        const psCommand = `
          $env:ELECTRON_RUN_AS_NODE = '1';
          sc.exe delete "${serviceName}" 2>$null;
          sc.exe create "${serviceName}" binPath= "${binPath}" start= auto DisplayName= "${displayName}";
          sc.exe description "${serviceName}" "${description}";
          sc.exe start "${serviceName}";
          exit $LASTEXITCODE
        `;

        const svcProcess = spawn('powershell.exe', [
          '-NoProfile',
          '-ExecutionPolicy', 'Bypass',
          '-Command', psCommand
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        svcProcess.stdout?.on('data', (d) => log.info(`[Service] ${d.toString().trim()}`));
        svcProcess.stderr?.on('data', (d) => log.warn(`[Service Warn] ${d.toString().trim()}`));

        svcProcess.on('error', (err) => {
          log.error('Service spawn error:', err);
          resolve({ success: false, error: 'Failed to launch service installer: ' + err.message });
        });

        svcProcess.on('close', (code) => {
          if (code === 0 || code === null) {
            log.info('Windows service registered and started successfully.');
            resolve({ success: true });
          } else {
            log.warn(`sc.exe exited with code ${code} — service may already exist or need UAC. Continuing...`);
            // Don't fail setup over service registration — user can start it manually
            resolve({ success: true });
          }
        });

      } catch (err: any) {
        log.error('Failed to install Windows service:', err);
        resolve({ success: false, error: err.message });
      }
    });
  });

  ipcMain.handle('setup:complete', () => {
    log.info('Setup completed, restarting application...');
    appInstance.relaunch();
    appInstance.exit(0);
  });
}
