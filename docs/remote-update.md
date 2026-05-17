# Remote Update System — Developer Reference

This document describes the complete update pipeline end-to-end: from a developer
pushing a new version, to a client machine running fully updated software with
migrated database schema.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Components Involved](#2-components-involved)
3. [Part A — Developer: Releasing a New Version](#part-a--developer-releasing-a-new-version)
   - [Step 1 — Add any new database migrations](#step-1--add-any-new-database-migrations)
   - [Step 2 — Bump the version number](#step-2--bump-the-version-number)
   - [Step 3 — Commit and push](#step-3--commit-and-push)
   - [Step 4 — Trigger the release](#step-4--trigger-the-release)
   - [Step 5 — What CI does automatically](#step-5--what-ci-does-automatically)
   - [Step 6 — Verify the GitHub Release](#step-6--verify-the-github-release)
4. [Part B — Client Machine: Detecting and Downloading the Update](#part-b--client-machine-detecting-and-downloading-the-update)
   - [Step 7 — Update check on startup](#step-7--update-check-on-startup)
   - [Step 8 — Background download](#step-8--background-download)
   - [Step 9 — "Update ready" UI](#step-9--update-ready-ui)
5. [Part C — Client Machine: Installing the Update](#part-c--client-machine-installing-the-update)
   - [Step 10 — Pre-install database backup](#step-10--pre-install-database-backup)
   - [Step 11 — NSIS installer replaces the app](#step-11--nsis-installer-replaces-the-app)
6. [Part D — Client Machine: First Startup After Update](#part-d--client-machine-first-startup-after-update)
   - [Step 12 — Database migration runs automatically](#step-12--database-migration-runs-automatically)
   - [Step 13 — Backend server starts on migrated schema](#step-13--backend-server-starts-on-migrated-schema)
7. [Configuration Reference](#7-configuration-reference)
8. [File Map](#8-file-map)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Architecture Overview

```
DEVELOPER MACHINE                        GITHUB                      CLIENT MACHINE
─────────────────                        ──────                      ──────────────

1. Write SQL migration                   Release v4.1.0              7. electron-updater polls
2. Bump version in package.json   ──►    ├── latest.yml                 GitHub Releases API
3. git tag v4.1.0                        ├── RELEASES.json              every 6 hours + on startup
4. git push --tags                       └── Chapter One POS    ◄──  8. Downloads installer to
                                             Setup 4.1.0.exe              %AppData%\Local\Temp
5. GitHub Actions (release.yml)                                      9. UI shows "Update ready"
   ├── npm ci
   ├── set-version.js 4.1.0                                         10. User clicks install →
   └── electron-builder                                                 pg_dump backup to Desktop
       --win --publish always ──────────────────────────────────►   11. NSIS installer runs,
                                                                         app files replaced

                                                                     12. App restarts →
                                                                         migrate.js runs pending
                                                                         SQL files against DB
                                                                     13. Backend server starts
                                                                         on updated schema ✓
```

**Key design decisions:**

| Decision | Reason |
|----------|--------|
| GitHub Releases as update server | No infrastructure to maintain; Releases API is the native `electron-updater` target |
| Migrations run on startup, not install | NSIS installer has no database access; Electron main process does |
| Backup before install, not after | Protects against failed migrations or installer corruption |
| `autoInstallOnAppQuit = false` | Prevents silent install without the backup step |
| Migration runner is the backend's own `migrate.js` | Single authoritative migration script with correct PostgreSQL credentials and path resolution |

---

## 2. Components Involved

| Component | File | Role |
|-----------|------|------|
| **CI release pipeline** | `.github/workflows/release.yml` | Builds and publishes installer to GitHub Releases |
| **Version sync script** | `scripts/set-version.js` | Writes the release version into `package.json` during CI |
| **electron-builder config** | `package.json` → `"build"` section | Defines NSIS installer format and GitHub publish target |
| **Update manager** | `updater/updateManager.js` | Polls GitHub Releases, downloads update, triggers backup + install |
| **Backup module** | `updater/dbBackup.js` | Runs `pg_dump` to create a plain-SQL backup on the client Desktop |
| **Main process startup** | `electron/src/main.ts` | Runs migrations before backend starts; passes db config to updater |
| **Migration script** | `backend/src/scripts/migrate.ts` (compiled → `backend/dist/scripts/migrate.js`) | Applies pending `.sql` files, tracks applied files in `migrations` table |
| **Migration files** | `database/migrations/*.sql` | Numbered SQL files, one per schema change |
| **Login screen** | `frontend/src/pages/LoginScreen.tsx` | Displays update progress, backup status, and install button |
| **Preload bridge** | `electron/src/preload.ts` | Exposes `installUpdate`, `getUpdateStatus`, `ipcRenderer.on` to the renderer |

---

## Part A — Developer: Releasing a New Version

### Step 1 — Add any new database migrations

If this release changes the database schema, create a new `.sql` file in
`database/migrations/`. Use the next sequential number in the `NNN_description.sql`
format:

```
database/migrations/
  041_add_delivery_charge.sql   ← last existing
  042_add_orders_table.sql      ← your new file
```

**Rules:**
- Files are executed in alphabetical (lexicographic) sort order, so the numeric
  prefix determines execution order. Always use three digits and keep numbering
  consecutive.
- Every statement must be safe to run on an existing database — use
  `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
  etc. The migration runner skips files that are already recorded in the `migrations`
  table, but the SQL itself must not fail if a later dev runs it against a fresh DB.
- Each file is wrapped in an explicit `BEGIN … COMMIT` transaction by the runner.
  A failure triggers `ROLLBACK` and aborts startup — write atomic, rollback-safe SQL.

**No migration needed?** Skip this step. The update pipeline works the same
regardless; the migration step simply finds zero pending files and completes instantly.

---

### Step 2 — Bump the version number

Edit `package.json` at the project root and increment the `"version"` field following
[Semantic Versioning](https://semver.org/):

```json
{
  "version": "4.1.0"
}
```

| Change type | Example | When to use |
|-------------|---------|-------------|
| Patch `4.0.9 → 4.0.10` | Bug fix, no schema change | Minor fixes only |
| Minor `4.0.9 → 4.1.0` | New feature or schema migration | New capability, backwards-compatible |
| Major `4.0.9 → 5.0.0` | Breaking change | Rare; reserved for incompatible changes |

> `electron-updater` compares versions using semver. It only downloads and offers
> an update if the GitHub Release version is strictly greater than the version
> embedded in the installed app. The version in `package.json` is what gets embedded
> into the installer.

---

### Step 3 — Commit and push

```bash
git add database/migrations/042_add_orders_table.sql
git add package.json
git commit -m "feat: add orders table and bump version to 4.1.0"
git push origin main
```

This push triggers the **CI** pipeline (`ci.yml`) which lints the code, validates the
version, and checks migration file naming — but does **not** publish a release.

---

### Step 4 — Trigger the release

There are two equivalent ways:

**Option A — Git tag (recommended)**

```bash
git tag v4.1.0
git push origin v4.1.0
```

The tag push matches the `on.push.tags: ['v*']` trigger in `release.yml` and starts
the release job automatically.

**Option B — GitHub Actions manual dispatch**

Go to `Actions → Production Release → Run workflow` in the GitHub UI, enter the
version string (e.g. `4.1.0`), and click Run. Use this for hotfixes or when you
need to release without tagging.

---

### Step 5 — What CI does automatically

The `release.yml` job runs on a `windows-latest` runner and performs these steps in
sequence:

```
1. actions/checkout@v4          Full repo clone (fetch-depth: 0 for complete history)
2. setup-node@v4 (Node 20)      Install Node.js with npm cache
3. npm ci                       Clean install of all workspace dependencies
4. Resolve Version              Extracts version from tag (v4.1.0 → 4.1.0) or
                                 uses the workflow_dispatch input
5. node scripts/set-version.js 4.1.0
                                Writes the version into package.json so the
                                compiled Electron app reports the correct version
6. npm run release:win          Expands to:
                                  npm install
                                  npm run build          (frontend + backend + electron TypeScript)
                                  npm run install:backend:prod
                                  npm run prune:backend
                                  npx electron-builder --win --publish always
```

`electron-builder --publish always` does three things:
- Builds the NSIS `.exe` installer (64-bit Windows)
- Generates `latest.yml` (the version manifest `electron-updater` polls)
- Uploads both artifacts to the GitHub Release, creating the Release if it does
  not exist yet

The `GH_TOKEN` environment variable is set to `secrets.GITHUB_TOKEN` (auto-injected
by GitHub Actions). The repository must grant the workflow `contents: write`
permission, which is declared at the top of `release.yml`.

**Build output:**

```
dist-installer/
  Chapter One POS Setup 4.1.0.exe    ← NSIS installer
  latest.yml                          ← version manifest for electron-updater
```

**What is in the installer:**
- Compiled Electron main process (`electron/dist/`)
- Built React frontend (`frontend/dist/`)
- Compiled Node.js backend (`backend/dist/` + `backend/node_modules/`)
- Updater modules (`updater/`)
- Database migration files (`database/migrations/*.sql`) — shipped as
  `extraResources` so they land at `resources/database/migrations/` inside the
  installation directory
- Electron runtime (bundled by electron-builder)
- Configuration files (`config/`)

**What is NOT in the installer:**
- `.env` file — credentials are never bundled; they live in the client's
  `%AppData%\Chapter One POS\` (`userData`) directory and survive updates
- Source files (`*.ts`, `*.tsx`) — compiled output only
- Dev dependencies

---

### Step 6 — Verify the GitHub Release

After CI completes (usually 5–10 minutes), check:

```
https://github.com/Valuablehope/Chapter_One/releases
```

Confirm that the Release for `v4.1.0` contains:
- `Chapter One POS Setup 4.1.0.exe`
- `latest.yml`
- `Chapter One POS Setup 4.1.0.exe.blockmap` (differential update manifest)

The release is now live. All running client instances will detect it on their next
update check.

---

## Part B — Client Machine: Detecting and Downloading the Update

### Step 7 — Update check on startup

When the packaged app starts, `main.ts` calls:

```javascript
// electron/src/main.ts  (production path, after backend is ready)
require('.../updater/updateManager.js').init(mainWindow, appDbConfig, app.getPath('desktop'));
```

Inside `init()` in `updater/updateManager.js`:

```javascript
autoUpdater.logger = logger;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;  // ← no silent install without backup

const isOnline = await checkInternetConnection();  // DNS resolve github.com
if (isOnline) {
  await autoUpdater.checkForUpdates();
}
```

`autoUpdater.checkForUpdates()` fetches:
```
https://github.com/Valuablehope/Chapter_One/releases/latest/download/latest.yml
```

It compares the version in `latest.yml` against the version compiled into the
running app (`app.getVersion()`). If the remote version is greater, a download
starts automatically.

**Periodic re-check:** A `setInterval` fires `checkForUpdates()` every 6 hours for
long-running sessions:

```javascript
setInterval(async () => {
  const online = await checkInternetConnection();
  if (online) autoUpdater.checkForUpdates();
}, 6 * 60 * 60 * 1000);
```

---

### Step 8 — Background download

When a newer version is found, `electron-updater` emits `update-available` and
immediately starts downloading the installer into a temp directory
(`%LocalAppData%\Temp\` on Windows). No user interaction is required.

The download emits `download-progress` events that are forwarded to the renderer
via IPC:

```javascript
autoUpdater.on('update-available', (info) => {
  emitStatus('downloading', { percent: 0, version: info.version });
});

autoUpdater.on('download-progress', (progressObj) => {
  emitStatus('downloading', { percent: progressObj.percent, speed: progressObj.bytesPerSecond });
});
```

The Login screen receives these events via `ipcRenderer.on('updater:status', ...)` and
displays a progress indicator:

```
● Downloading Update... 47%
```

The app remains fully usable during the background download.

---

### Step 9 — "Update ready" UI

When the download completes, `electron-updater` emits `update-downloaded`:

```javascript
autoUpdater.on('update-downloaded', (info) => {
  emitStatus('ready', { version: info.version });
});
```

The Login screen transitions to showing the install button:

```
  ✨ Update to Latest Version
```

The installer is now sitting in the temp directory, verified by checksum.
The app has **not** been modified yet.

---

## Part C — Client Machine: Installing the Update

### Step 10 — Pre-install database backup

When the user clicks **Update to Latest Version**, the renderer calls:

```typescript
window.electronAPI.installUpdate();
// → ipcRenderer.invoke('app:installUpdate')
```

The IPC handler in `main.ts` runs:

```typescript
ipcMain.handle('app:installUpdate', async () => {
  await require('.../updater/updateManager.js').backupAndInstall();
});
```

`backupAndInstall()` in `updater/updateManager.js`:

```javascript
async function backupAndInstall() {
  emitStatus('backing-up');  // → UI: "Creating database backup..."

  const result = await createBackup(appDbConfig, appDesktopPath);

  if (result.success) {
    emitStatus('backup-done', { backupPath: result.backupPath });
    // → UI: "Backup saved to Desktop. Installing..."
  } else {
    emitStatus('backup-skipped', { error: result.error });
    // → UI: "Backup unavailable — installing update..."
  }

  await sleep(1500);  // let the UI render before the process quits

  autoUpdater.quitAndInstall();
}
```

**Inside `createBackup()`** (`updater/dbBackup.js`):

1. Searches for `pg_dump.exe` in:
   - `C:\Program Files\PostgreSQL\<version>\bin\pg_dump.exe`
   - `C:\Program Files (x86)\PostgreSQL\<version>\bin\pg_dump.exe`
   - Newest PostgreSQL version is preferred.

2. Runs:
   ```
   pg_dump -h <DB_HOST> -p <DB_PORT> -U <DB_USER> -d <DB_NAME>
           -F p --no-password -f "<Desktop>\chapter_one_backup_2026-05-17_14-30-00.sql"
   ```
   with `PGPASSWORD=<DB_PASSWORD>` in the subprocess environment.
   Timeout: 2 minutes.

3. Returns `{ success: true, backupPath: "C:\Users\...\Desktop\chapter_one_backup_....sql" }`
   on success, or `{ success: false, error: "..." }` if `pg_dump` is not found or
   fails.

**The backup step is non-fatal.** If `pg_dump` is not found or the dump fails, a
`backup-skipped` status is emitted and the update proceeds anyway. The client is
never left stranded on an older version because of a backup failure.

**The backup file** is a standard plain-SQL PostgreSQL dump. It can be restored with:
```bash
psql -h <host> -U <user> -d <database> -f chapter_one_backup_2026-05-17_14-30-00.sql
```

---

### Step 11 — NSIS installer replaces the app

`autoUpdater.quitAndInstall()` does two things:

1. **Quits** the Electron app (all windows close, backend child process is killed via
   `taskkill /f /t`, `before-quit` hooks run).
2. **Launches** the downloaded NSIS installer silently (`/S` flag — no user prompts).

The NSIS installer:
- Stops the `Chapter One POS` Windows service if running
- Replaces all files in the installation directory (e.g.
  `C:\Program Files\Chapter One POS\`) with the new version
- Does **not** touch `%AppData%\Chapter One POS\` (`userData`) — the `.env` file
  with database credentials survives untouched
- Relaunches the app after installation completes

The client machine now has the new `.exe` and the new `database/migrations/*.sql`
files at `resources/database/migrations/`.

---

## Part D — Client Machine: First Startup After Update

### Step 12 — Database migration runs automatically

This is the first thing that happens on startup, before the backend server starts.

In `electron/src/main.ts`, inside `app.whenReady()`:

```typescript
// 1. Parse .env from userData/
const startupEnvPath = getEnvPath();
const startupEnv = buildBackendEnv(startupEnvPath);
appDbConfig = extractDbConfig(startupEnv);  // store for backup use

// 2. Run migrations
log.info('🗄️ Running database migrations...');
try {
  await runMigrationsOnStartup(startupEnv);
} catch (err) {
  showStartupErrorAndQuit('Database Migration Failed', err.message);
  return;
}

// 3. Start backend server (only after migrations succeed)
const backendStarted = startBackendServer();
```

`runMigrationsOnStartup()` spawns the backend's compiled migration script as a
one-shot Node.js subprocess:

```typescript
async function runMigrationsOnStartup(env: NodeJS.ProcessEnv): Promise<void> {
  const migrateScript = path.join(backendDir, 'dist/scripts/migrate.js');
  // backendDir = resources/backend/ in production

  const migrationProcess = spawn(process.execPath, [migrateScript], {
    env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // stdout → log.info('[Migration] ...')
  // stderr → log.error('[Migration] ...')
  // exit 0 → resolve()  |  exit ≠ 0 → reject() → startup aborts
}
```

**Inside `migrate.js`** (`backend/src/scripts/migrate.ts` compiled):

```
1. Connect to PostgreSQL using DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
   (or DATABASE_URL) from the env passed by Electron

2. CREATE TABLE IF NOT EXISTS migrations (
     id SERIAL PRIMARY KEY,
     name VARCHAR(255) NOT NULL UNIQUE,
     executed_at TIMESTAMPTZ DEFAULT now()
   );

3. SELECT name FROM migrations;
   → build Set of already-applied filenames

4. Scan resources/database/migrations/*.sql  (sorted lexicographically)
   Filter to files NOT in the executed Set → pending list

5. For each pending file:
   a. BEGIN
   b. Execute the SQL
   c. INSERT INTO migrations (name) VALUES ('<filename>')
   d. COMMIT
   e. On error → ROLLBACK, throw (aborts startup)

6. EXIT 0 (success) or EXIT 1 (failure)
```

The migration script locates `database/migrations/` using this priority order:

```typescript
const possibleDirs = [
  path.resolve(__dirname, '../../../database/migrations'),   // dev: backend/dist/scripts/ → up 3
  path.resolve(process.cwd(), 'database/migrations'),        // cwd fallback
  path.resolve(process.cwd(), 'resources/database/migrations'),
  path.resolve(process.env.RESOURCES_PATH, 'database/migrations'), // ← production hit
];
```

In production, `RESOURCES_PATH` is set by Electron's `main.ts` in the subprocess
env, so the fourth candidate resolves correctly to
`C:\Program Files\Chapter One POS\resources\database\migrations\`.

**If migration fails:** `runMigrationsOnStartup` rejects, `showStartupErrorAndQuit`
displays a dialog with the error message, and the app exits. The database is not
corrupted — each migration is wrapped in a transaction that rolls back on error.
The client should restore from the backup on their Desktop and contact support.

**If no migrations are pending:** The script logs "All migrations completed
successfully" after zero iterations and exits 0 instantly. Normal startup continues.

---

### Step 13 — Backend server starts on migrated schema

Only after `runMigrationsOnStartup` resolves does `startBackendServer()` execute.
The backend process is spawned with the same env vars, connects to PostgreSQL
(which now has the updated schema), and serves the API.

The app window opens and the user can log in — the update is complete.

---

## 7. Configuration Reference

### electron-builder publish config (`package.json`)

```json
"publish": {
  "provider": "github",
  "owner": "Valuablehope",
  "repo": "Chapter_One",
  "releaseType": "release"
}
```

`releaseType: "release"` means electron-builder creates a full public GitHub Release
(not a draft or pre-release). Change to `"prerelease"` for beta releases if needed.

### GitHub Actions secrets

| Secret | Value | Used by |
|--------|-------|---------|
| `GITHUB_TOKEN` | Auto-injected by GitHub Actions | `electron-builder --publish always` to upload release assets |

No manual secret setup is required. `GITHUB_TOKEN` is available in every repository
workflow automatically.

### `autoInstallOnAppQuit`

Set to `false` in `updater/updateManager.js`. This means:
- The downloaded update **will not** install automatically when the user closes the
  app through the window X button.
- Installation only happens when the user explicitly clicks **Update to Latest Version**.
- This guarantees the backup step always runs before install.

If you ever need to allow silent install on quit (e.g. for unattended kiosk
machines), set this to `true`, but be aware the backup step will be bypassed.

---

## 8. File Map

```
Chapter_One/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                  Lint + version validate on push/PR
│       └── release.yml             Build + publish on tag push or manual dispatch
│
├── database/
│   └── migrations/
│       ├── 000_base_schema.sql
│       ├── 001_create_receipt_counters.sql
│       ├── ...
│       └── 043_add_orders_customer_index.sql   ← add new files here for each release
│
├── electron/
│   └── src/
│       ├── main.ts                 Startup: buildBackendEnv → runMigrationsOnStartup → startBackendServer
│       └── preload.ts              Exposes installUpdate / getUpdateStatus to renderer
│
├── frontend/
│   └── src/pages/
│       └── LoginScreen.tsx         Update progress UI (checking → downloading → ready → backing-up → backup-done)
│
├── backend/
│   └── src/scripts/
│       └── migrate.ts              The migration runner (compiled to backend/dist/scripts/migrate.js)
│
├── updater/
│   ├── updateManager.js            electron-updater lifecycle + backupAndInstall()
│   └── dbBackup.js                 pg_dump wrapper → Desktop backup file
│
├── scripts/
│   ├── set-version.js              Writes version into package.json (used by CI)
│   └── validate-version.js         Validates semver format (used by CI)
│
└── package.json                    electron-builder config + publish target + npm scripts
```

---

## 9. Troubleshooting

### Update is not detected on client machines

1. Confirm the GitHub Release exists and contains `latest.yml`:
   `https://github.com/Valuablehope/Chapter_One/releases`
2. Confirm the client machine has internet access and can reach `github.com`.
3. Confirm the version in the new Release is strictly greater than the installed
   version (semver comparison — `4.1.0 > 4.0.9`).
4. Check the Electron log file:
   `%AppData%\Chapter One POS\logs\combined.log`
   Look for `checking-for-update`, `update-not-available`, or `error` entries.

### Backup is skipped with "pg_dump not found"

The client machine does not have PostgreSQL's `bin/` directory in any of the
expected locations under `C:\Program Files\PostgreSQL\`. This happens when:
- PostgreSQL was installed with a non-standard path.
- The client uses a remote PostgreSQL server and never installed PostgreSQL locally.

The update will still proceed. If you need guaranteed backups for these clients,
consider adding a Node.js-native SQL dump fallback to `updater/dbBackup.js`
(querying `pg_dump`-equivalent DDL + COPY statements through the `pg` client).

### Migration fails on startup after update

The app shows "Database Migration Failed" and exits. Steps to recover:

1. Locate the backup on the Desktop:
   `chapter_one_backup_YYYY-MM-DD_HH-MM-SS.sql`
2. Restore the backup:
   ```bash
   psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f chapter_one_backup_....sql
   ```
3. Roll back to the previous installer if available, or fix the failing SQL migration
   file, re-run CI to publish a patched release, and re-update.
4. The failing migration filename is logged in:
   `%AppData%\Chapter One POS\logs\combined.log`
   Look for `[Migration] ✗ Migration failed:` or `[Migration] Failed to execute`.

### How to check which migrations have been applied

Connect to the PostgreSQL database and query:

```sql
SELECT name, executed_at FROM migrations ORDER BY id;
```

Filenames listed here have already been applied. Files present in
`resources/database/migrations/` but absent from this table will run on the next
startup.

### How to release a hotfix without a new feature

Increment only the patch version (`4.1.0 → 4.1.1`), add no migration file, commit,
tag, and push. The pipeline is identical. The migration step on the client finds
zero pending files and completes instantly.

### How to test the update flow locally (development)

`autoUpdater` skips all checks when `app.isPackaged` is `false` (development mode).
To test end-to-end:

1. Build a local installer: `npm run build:win` (produces `dist-installer/`)
2. Install it on a test Windows machine.
3. Build a second installer with a higher version number.
4. Host it locally with a custom `electron-builder.yml` pointing the publish
   provider to a local server, or push to a GitHub Release on a test repository.

Alternatively, set `GH_TOKEN` locally and run `npm run release:win` against a
test repo to publish a real GitHub Release for QA.
