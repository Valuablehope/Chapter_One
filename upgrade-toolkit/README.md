# Chapter One POS — Upgrade Toolkit

Standalone operator tool for safely taking a client through a one-time jump
from an old version to the current version. **Not part of the shipped app**
— never referenced by electron-builder's `files`/`extraResources`, run only
by hand during a remote support session.

## Easiest way: the GUI

Double-click **`Start Upgrade Toolkit.bat`** in this folder. On first run it
figures out Node.js on its own — see below — installs the toolkit's own
dependencies, starts a small local web server, and opens your browser to a
page with a button for every step (Preflight, Backup, Verify Backup, Offsite
Copy, Upgrade, Post-Verify, Rollback). Each button shows its live log output
right on the page, and buttons that shouldn't run yet (e.g. Upgrade before
the backup is verified) stay disabled with a clear reason.

**No prerequisites to install by hand.** The client's machine normally has
no system-wide Node.js — the app bundles its own inside Electron, which
isn't something a script can invoke directly. `Start Upgrade Toolkit.bat`
handles this itself:

1. Uses a suitable Node.js already on the machine's PATH, if there is one.
2. Otherwise reuses a portable copy it downloaded on a previous run.
3. Otherwise downloads the official Windows build straight from
   `nodejs.org`, verifies its SHA-256 against nodejs.org's own published
   checksums, and extracts it into `.node-portable/` next to this folder —
   no installer, no admin rights, no system PATH changes. Delete that folder
   afterward if you don't want to leave anything behind.

This needs the client's machine to have internet access (same requirement
the app's own auto-updater already has). If it doesn't, install Node.js
manually from nodejs.org first and the script will just use that instead.

To start it manually instead of double-clicking (once Node.js is available
one way or another):

```
npm install
npm run ui
```

The rest of this README documents the underlying CLI commands the GUI calls
— useful if you prefer the terminal, need to script something, or want to
understand exactly what each button does before clicking it.

## Running the CLI directly

```
npm install
npx tsx src/cli.ts <command> [options]
```

No build step — `tsx` runs the TypeScript directly, matching how `backend`'s
own `npm run dev` already works in this repo.

## Why this exists

The app already auto-updates safely for routine releases (see
`../docs/remote-update.md`): backup-then-install, migrate-on-startup. That
pipeline is fine for a small, frequent version bump, but it has three gaps
that matter for a client who hasn't updated in a long time and is about to
jump many versions at once, on their only copy of production data:

1. Its backup is best-effort — if `pg_dump` isn't found, the update proceeds
   **without** a backup.
2. The backup is never restore-tested. A corrupt dump would only be
   discovered when it's actually needed.
3. Uploaded product images (`resources/backend/uploads/products`) are never
   backed up at all, and live in the exact directory tree that gets
   overwritten by every version's installer package.

This toolkit wraps the same underlying mechanisms (the same `pg_dump`, the
same `migrate.js`, the same NSIS installer) with real gates: a backup is not
trusted until it's actually been restored and reconciled, and the upgrade
step refuses to run until that's proven.

## Operator runbook

Run these in order, on the client's machine, over your remote session. Every
step writes to `<run-dir>/log.txt` so there's an audit trail next to the
backup itself.

### 0. Before you start

- Confirm you have remote control of the client's machine, and that it has
  internet access (needed once, to fetch Node.js automatically if it isn't
  already on the machine — see above).
- **Get this `upgrade-toolkit` folder onto the client's machine.** Easiest
  way, no git required: on the client machine, go to
  `https://github.com/Valuablehope/Chapter_One`, click **Code → Download
  ZIP**, extract it, and copy just the `upgrade-toolkit` folder out
  somewhere convenient (e.g. the Desktop) — you don't need the rest of the
  repo.
- Have the new version's installer `.exe` ready on the client's machine —
  make sure it's a build made *after* any fixes you need (e.g. rebuild with
  `npm run build:win` if `package.json`'s packaging config changed since the
  last build) — and ideally the client's *current* version's installer too,
  in case you need to roll back.
- Decide where the off-machine backup copy will go (external drive, network
  share, cloud-synced folder) — you'll need this path in step 4.

### 1. Preflight

```
npx tsx src/cli.ts preflight
```

Auto-discovers the install, PostgreSQL binaries, and `.env`. Creates a new
timestamped run folder under `upgrade-toolkit/backups/` and writes
`preflight-report.txt` — **read this before doing anything else**. It tells
you: how many migrations are pending, current row counts, DB size, how many
uploaded product images exist, whether any other process still has an open
connection to the database (if so, **close the Chapter One POS app now** —
check Task Manager for any orphaned backend/node process too), and whether
there's enough free disk space.

If auto-discovery fails (unusual install location, non-standard PostgreSQL
path, `.env` in an unexpected place), pass `--install-dir`, `--pg-bin-dir`,
or `--env-path` explicitly — the error messages tell you which one to add.

Note the run directory path it prints — every subsequent command needs
`--run-dir <that path>`.

### 2. Backup

```
npx tsx src/cli.ts backup --run-dir "<run-dir>"
```

Takes a restorable custom-format dump, a plain-SQL fallback dump, and a
checksummed copy of the uploaded product images. Refuses to proceed if
another connection to the database is still open — pass `--force` only if
you're certain it's harmless.

### 3. Verify the backup — do not skip this

```
npx tsx src/cli.ts verify-backup --run-dir "<run-dir>"
```

Actually restores the dump into a throwaway scratch database and reconciles
every table's row count against what was live. This is the hard gate: if it
fails, **do not proceed to upgrade** — investigate, and re-run `backup` then
`verify-backup`.

### 4. Copy the backup off the machine

```
npx tsx src/cli.ts offsite-copy --run-dir "<run-dir>" --dest "<external drive or network path>"
```

Checksum-verified copy, so a disk or machine failure during the upgrade
itself can't take out your only backup too.

### 5. Upgrade

```
npx tsx src/cli.ts upgrade --run-dir "<run-dir>" --installer "<path to new version's installer .exe>"
```

Refuses to run unless step 3 passed. Confirm the app is closed, then this
installs the new version silently and immediately runs `migrate.js` directly
(before the app UI ever opens), logging its full output and capturing its
exit code:

- **0** — migrations succeeded, safe to start the app.
- **1** — a migration failed. The database is still consistent (each
  migration runs in its own transaction) but incomplete. Fix the failing SQL
  and re-run `upgrade`, or run `rollback`.
- **2** — the database was unreachable. Check PostgreSQL is running and
  retry.

### 6. Post-verify

```
npx tsx src/cli.ts post-verify --run-dir "<run-dir>"
```

Confirms every migration is now recorded, no table lost rows compared to the
backup manifest (growth is fine, loss is not), and every uploaded image
still resolves with a matching checksum. Prints a manual smoke-test
checklist — actually do it: log in, open a recent sale, check stock for a
known product, confirm a product image loads on screen.

### If anything goes wrong: rollback

```
npx tsx src/cli.ts rollback --run-dir "<run-dir>" --previous-installer "<path to previous version's installer>"
```

Always available. Without `--yes` it only prints what it would do. Restores
the database and uploads from this run's **verified** backup, then
reinstalls the previous version's `.exe` **over** the current install (never
uninstall-then-install — that would wipe the `.env` with DB credentials via
`deleteAppDataOnUninstall`). If you don't have the previous installer handy,
omit `--previous-installer` — the database and uploads are still restored,
you'll just need to reinstall the old version's app files manually
afterward.

### Check status any time

```
npx tsx src/cli.ts status --run-dir "<run-dir>"
```

Prints which steps have completed — useful for resuming after a break or
handing off mid-procedure.

## Global options (work on every command)

- `--env-path <path>` — skip `.env` auto-discovery
- `--install-dir <path>` — skip install-directory auto-discovery
- `--pg-bin-dir <path>` — skip PostgreSQL binary auto-discovery

## Dry-run against a throwaway copy first

Before running this against a real client machine, run the full sequence
once against a disposable copy of an old-schema database and a scratch
`uploads/products` folder — point `--install-dir` at a directory whose
`resources/backend` and `resources/database` mirror the real layout, and
`--env-path` at a `.env` pointing to the throwaway database. Confirm
`preflight` reports the right pending-migration count, `verify-backup`
genuinely catches a deliberately corrupted dump, `upgrade` runs `migrate.js`
cleanly, and `rollback` puts everything back exactly as it was.
