import { EventEmitter } from 'events';

export interface LogEntry {
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: string;
}

// Every Logger instance publishes here in addition to console/file. The UI
// server subscribes for the duration of whichever single job is currently
// running (the toolkit only ever runs one job at a time) so it can stream
// the exact same lines an operator would see in a terminal into the browser.
export const logBus = new EventEmitter();
logBus.setMaxListeners(50);

export function emitLogLine(entry: LogEntry): void {
  logBus.emit('line', entry);
}
