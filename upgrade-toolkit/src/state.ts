import * as fs from 'fs';
import * as path from 'path';
import { RunState } from './types';

const STATE_FILENAME = '.state.json';

export function stateFilePath(runDir: string): string {
  return path.join(runDir, STATE_FILENAME);
}

export function readState(runDir: string): RunState {
  const filePath = stateFilePath(runDir);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No ${STATE_FILENAME} found in ${runDir} — run "preflight" first to start a run.`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeState(state: RunState): void {
  fs.writeFileSync(stateFilePath(state.runDir), JSON.stringify(state, null, 2), 'utf8');
}
