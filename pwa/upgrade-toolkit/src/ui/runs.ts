import * as fs from 'fs';
import * as path from 'path';
import { readState } from '../state';

export interface RunSummary {
  runDir: string;
  createdAt: string;
  steps: Record<string, boolean>;
  verifyBackupPassed: boolean | null;
}

export function listRuns(backupsRoot: string): RunSummary[] {
  if (!fs.existsSync(backupsRoot)) return [];

  const entries = fs
    .readdirSync(backupsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(backupsRoot, e.name));

  const summaries: RunSummary[] = [];
  for (const runDir of entries) {
    try {
      const state = readState(runDir);
      summaries.push({
        runDir,
        createdAt: state.createdAt,
        steps: {
          preflight: !!state.steps.preflight,
          backup: !!state.steps.backup,
          verifyBackup: !!state.steps.verifyBackup,
          offsiteCopy: !!state.steps.offsiteCopy,
          upgrade: !!state.steps.upgrade,
          postVerify: !!state.steps.postVerify,
          rollback: !!state.steps.rollback,
        },
        verifyBackupPassed: state.steps.verifyBackup?.verified ?? null,
      });
    } catch {
      // Not a valid run directory (no .state.json yet) — skip it.
    }
  }

  return summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
