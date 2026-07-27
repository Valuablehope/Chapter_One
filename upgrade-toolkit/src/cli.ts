import { Command } from 'commander';
import * as path from 'path';
import { readState } from './state';
import { RunState } from './types';
import {
  actionPreflight,
  actionBackup,
  actionVerifyBackup,
  actionOffsiteCopy,
  actionUpgrade,
  actionPostVerify,
  actionRollback,
} from './actions';

const program = new Command();

program
  .name('c1-upgrade')
  .description('Standalone safety toolkit for backing up, upgrading, and verifying a client Chapter One POS installation.')
  .option('--env-path <path>', 'explicit path to the app .env file (skips auto-discovery)')
  .option('--install-dir <path>', 'explicit path to the app install directory (skips auto-discovery)')
  .option('--pg-bin-dir <path>', 'explicit path to the PostgreSQL bin directory (skips auto-discovery)');

function globalOpts() {
  return program.opts();
}

program
  .command('preflight')
  .description('Discover the install, report schema/migration state, row counts, disk space, and uploads — creates a new run directory.')
  .option('--backups-root <path>', 'directory under which a new timestamped run folder is created', path.join(__dirname, '..', 'backups'))
  .action(async (cmdOpts) => {
    const globals = globalOpts();
    const runDir = await actionPreflight({
      backupsRoot: cmdOpts.backupsRoot,
      envPath: globals.envPath,
      installDir: globals.installDir,
      pgBinDir: globals.pgBinDir,
    });
    console.log(`\nRun directory created: ${runDir}`);
    console.log(`Read ${path.join(runDir, 'preflight-report.txt')} before continuing.`);
    console.log(`Next: c1-upgrade backup --run-dir "${runDir}"`);
  });

program
  .command('backup')
  .description('Take a verified-format (custom) dump, a plain-SQL fallback dump, and back up uploads/products with checksums.')
  .requiredOption('--run-dir <path>', 'run directory created by "preflight"')
  .option('--force', 'proceed even if other active DB connections are detected', false)
  .action(async (cmdOpts) => {
    const runDir = path.resolve(cmdOpts.runDir);
    await actionBackup(runDir, globalOpts(), cmdOpts.force);
    console.log(`\nNext: c1-upgrade verify-backup --run-dir "${runDir}"`);
  });

program
  .command('verify-backup')
  .description('Restore the custom-format dump into a throwaway scratch database and reconcile row counts. This is the hard gate before upgrading.')
  .requiredOption('--run-dir <path>', 'run directory')
  .action(async (cmdOpts) => {
    const runDir = path.resolve(cmdOpts.runDir);
    const result = await actionVerifyBackup(runDir, globalOpts());

    if (!result.verified) {
      console.error('\n*** Backup is NOT verified. Do NOT proceed to "upgrade". Investigate and re-run "backup" then "verify-backup". ***');
      process.exitCode = 1;
      return;
    }

    console.log(`\nNext: c1-upgrade offsite-copy --run-dir "${runDir}" --dest <external drive or network path>`);
    console.log(`Then: c1-upgrade upgrade --run-dir "${runDir}" --installer <path to new version installer>`);
  });

program
  .command('offsite-copy')
  .description('Copy the run folder (dumps, uploads backup, manifest, logs) to an external drive or network path, checksum-verified.')
  .requiredOption('--run-dir <path>', 'run directory')
  .requiredOption('--dest <path>', 'destination root directory (external drive or UNC network path)')
  .action(async (cmdOpts) => {
    const runDir = path.resolve(cmdOpts.runDir);
    const result = await actionOffsiteCopy(runDir, cmdOpts.dest);
    console.log(`\nCopied to: ${result.dest}`);
  });

program
  .command('upgrade')
  .description('Refuses unless the backup is verified. Installs the new version silently, then runs migrate.js directly and captures its exit code.')
  .requiredOption('--run-dir <path>', 'run directory')
  .requiredOption('--installer <path>', 'path to the new version\'s installer .exe')
  .option('--expected-version <version>', 'assert the installed version equals this after installing')
  .option('--force', 'proceed even if other active DB connections are detected', false)
  .action(async (cmdOpts) => {
    const runDir = path.resolve(cmdOpts.runDir);
    const migrateResult = await actionUpgrade(runDir, globalOpts(), cmdOpts.installer, cmdOpts.expectedVersion, cmdOpts.force);

    if (migrateResult.exitCode !== 0) {
      console.error(
        `\n*** Migration exited with code ${migrateResult.exitCode} (${migrateResult.meaning}). ` +
          `Do not open the app. Either fix the failing migration and re-run "upgrade", or run "rollback" now. ***`
      );
      process.exitCode = 1;
      return;
    }

    console.log(`\nNext: c1-upgrade post-verify --run-dir "${runDir}"`);
  });

program
  .command('post-verify')
  .description('Confirm all migrations recorded, row counts reconcile against the manifest, and uploads reconcile.')
  .requiredOption('--run-dir <path>', 'run directory')
  .action(async (cmdOpts) => {
    const runDir = path.resolve(cmdOpts.runDir);
    const result = await actionPostVerify(runDir, globalOpts());

    if (!result.passed) {
      console.error('\n*** Post-verify FAILED — see log.txt for details. Consider "rollback". ***');
      process.exitCode = 1;
      return;
    }

    console.log('\nPost-verify PASSED. Complete the manual smoke-test checklist printed above before handing back to the client.');
  });

program
  .command('rollback')
  .description('Restore the DB and uploads from this run\'s verified backup. Always available. Never uninstalls before reinstalling.')
  .requiredOption('--run-dir <path>', 'run directory')
  .option('--previous-installer <path>', 'path to the previous version\'s installer, to reinstall it over the current install')
  .option('--yes', 'actually perform the rollback (omit to print what would happen without doing it)', false)
  .action(async (cmdOpts) => {
    const runDir = path.resolve(cmdOpts.runDir);
    readState(runDir); // validates the run dir exists before printing the dry-run

    if (!cmdOpts.yes) {
      console.log('\nDRY RUN (pass --yes to actually execute):');
      console.log(`  - DROP and recreate database, then pg_restore from this run's custom-format dump`);
      console.log(`  - Restore uploads/products from this run's uploads_backup`);
      console.log(
        cmdOpts.previousInstaller
          ? `  - Reinstall previous version over current install: ${cmdOpts.previousInstaller}`
          : '  - No --previous-installer given: app binaries will NOT be reinstalled, only DB + uploads restored.'
      );
      return;
    }

    await actionRollback(runDir, globalOpts(), cmdOpts.previousInstaller);
  });

program
  .command('status')
  .description('Print the current state of a run directory.')
  .requiredOption('--run-dir <path>', 'run directory')
  .action((cmdOpts) => {
    const runDir = path.resolve(cmdOpts.runDir);
    const state: RunState = readState(runDir);
    console.log(JSON.stringify(state, null, 2));
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(`\nFATAL: ${err.message}`);
  process.exitCode = 1;
});
