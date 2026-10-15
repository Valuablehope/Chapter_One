import { ipcMain, app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { Client } from 'pg';
import log from 'electron-log';
import { isSetupComplete } from './main';

// Resolves the .env path to write to, matching setup:saveConfig's own logic:
// always userData in packaged builds (avoids EPERM under Program Files).
function resolveWritableEnvPath(appInstance: Electron.App, getEnvPath: () => string | null): string {
  if (appInstance.isPackaged) {
    return path.join(appInstance.getPath('userData'), '.env');
  }
  return getEnvPath() || path.join(appInstance.getPath('userData'), '.env');
}

// Merges `config` into the on-disk .env (creating it if missing) and marks
// setup as completed. Shared by setup:saveConfig and terminal:pair so both
// paths persist config identically.
function writeEnvConfig(
  appInstance: Electron.App,
  getEnvPath: () => string | null,
  config: Record<string, string>
): string {
  const envPath = resolveWritableEnvPath(appInstance, getEnvPath);

  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  }

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

  Object.assign(envObj, config);
  envObj['SETUP_COMPLETED'] = 'true';

  const newContent = Object.entries(envObj).map(([k, v]) => `${k}=${v}`).join('\n');

  const dir = path.dirname(envPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(envPath, newContent, 'utf-8');
  return envPath;
}

// Same hash as backend's TerminalModel.hashPairingCode — both sides just hash
// the code independently, no shared secret needed for an expiring, single-use code.
function hashPairingCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

interface PairDbConfig {
  host?: string;
  port?: string;
  user?: string;
  password?: string;
  database?: string;
  connectionString?: string;
}

// Reads DB connection info from the currently active .env, for the "pair
// later" case where no explicit dbConfig is supplied by the caller.
function readActiveDbConfig(getEnvPath: () => string | null): PairDbConfig | null {
  const envPath = getEnvPath();
  if (!envPath || !fs.existsSync(envPath)) return null;
  const content = fs.readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) env[trimmed.substring(0, idx)] = trimmed.substring(idx + 1);
    }
  });
  return {
    host: env.DB_HOST || 'localhost',
    port: env.DB_PORT || '5432',
    user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'Chapter_One',
    connectionString: env.DATABASE_URL || '',
  };
}

export function setupIpcHandlers(
  appInstance: Electron.App,
  getEnvPath: () => string | null,
  startBackendServer: () => boolean,
  stopBackendServer: () => void
) {
  ipcMain.handle('setup:isComplete', () => {
    return isSetupComplete(getEnvPath());
  });

  ipcMain.handle('setup:saveConfig', async (_event, config: Record<string, string>) => {
    try {
      const envPath = writeEnvConfig(appInstance, getEnvPath, config);
      log.info('Setup config saved to:', envPath);
      return { success: true };
    } catch (error) {
      log.error('Failed to save setup config:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Redeems an admin-issued pairing code, binding this physical machine to a
  // specific `terminals` row (TERMINAL_ID in the local .env). Used both from
  // the Setup Wizard (dbConfig supplied — backend isn't running yet) and from
  // the in-app "This Terminal" panel (dbConfig omitted — reuses the running
  // backend's own .env, then restarts it so the new TERMINAL_ID takes effect).
  ipcMain.handle('terminal:pair', async (_event, { code, dbConfig }: { code: string; dbConfig?: PairDbConfig }) => {
    const resolvedConfig = dbConfig || readActiveDbConfig(getEnvPath);
    if (!resolvedConfig) {
      return { success: false, error: 'No database configuration available to pair with.' };
    }

    const client = resolvedConfig.connectionString
      ? new Client({ connectionString: resolvedConfig.connectionString })
      : new Client({
          host: resolvedConfig.host,
          port: parseInt(resolvedConfig.port || '5432', 10),
          user: resolvedConfig.user,
          password: resolvedConfig.password,
          database: resolvedConfig.database,
        });

    try {
      await client.connect();

      const lookup = await client.query(
        `SELECT terminal_id, name FROM terminals WHERE pairing_code_hash = $1 AND pairing_code_expires_at > now()`,
        [hashPairingCode(code)]
      );

      if (lookup.rows.length === 0) {
        return { success: false, error: 'Invalid or expired pairing code.' };
      }

      const { terminal_id: terminalId, name } = lookup.rows[0];

      await client.query(
        `UPDATE terminals
         SET pairing_code_hash = NULL, pairing_code_expires_at = NULL, hostname = $1, updated_at = CURRENT_TIMESTAMP
         WHERE terminal_id = $2`,
        [os.hostname(), terminalId]
      );

      writeEnvConfig(appInstance, getEnvPath, { TERMINAL_ID: terminalId });
      log.info(`Terminal paired: ${name} (${terminalId})`);

      // Only restart the backend for the "pair later" case (no dbConfig means
      // we reused the already-running backend's own .env). During initial
      // setup (dbConfig supplied), the backend hasn't started yet — the
      // wizard's own relaunch after setup:complete picks up TERMINAL_ID fine,
      // and starting it here early could race the rest of the install flow.
      if (!dbConfig) {
        stopBackendServer();
        setTimeout(() => startBackendServer(), 500);
      }

      return { success: true, terminal_id: terminalId, name };
    } catch (error) {
      log.error('Failed to pair terminal:', error);
      return { success: false, error: (error as Error).message };
    } finally {
      await client.end().catch(() => {});
    }
  });

  ipcMain.handle('setup:installPostgres', async (_event, { password, port }) => {
    try {
      log.info(`Checking if PostgreSQL is already installed and running on port ${port || '5432'}...`);
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
        return { success: true, skipped: true };
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
          return { success: true, skipped: true };
        }
        throw new Error(`PostgreSQL installer not found at ${installerPath}. Please place postgresql-installer.exe in the installers folder.`);
      }

      log.info(`Running PostgreSQL silent installation from: ${installerPath}`);

      // Execute unattended installation with UAC elevation using PowerShell
      const psCommand = `
        $process = Start-Process -FilePath '${installerPath}' -ArgumentList '--mode', 'unattended', '--unattendedmodeui', 'none', '--superpassword', '${password.replace(/'/g, "''")}', '--serverport', '${port || '5432'}' -Verb RunAs -Wait -PassThru
        if ($process) { exit $process.ExitCode } else { exit 1 }
      `;

      return await new Promise((resolve) => {
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
      });
    } catch (err: any) {
      log.error('Failed to initiate PostgreSQL install:', err);
      return { success: false, error: err.message };
    }
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
