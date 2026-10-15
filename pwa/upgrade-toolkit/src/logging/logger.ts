import * as fs from 'fs';
import * as path from 'path';
import { emitLogLine, LogEntry } from './logBus';

// Every step of the upgrade procedure writes here so there's a single,
// human-readable audit trail sitting next to the backup it describes.
export class Logger {
  private readonly logFilePath: string;

  constructor(runDir: string) {
    fs.mkdirSync(runDir, { recursive: true });
    this.logFilePath = path.join(runDir, 'log.txt');
  }

  private write(level: LogEntry['level'], message: string): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${message}`;
    if (level === 'ERROR') {
      console.error(line);
    } else {
      console.log(line);
    }
    fs.appendFileSync(this.logFilePath, line + '\n', 'utf8');
    emitLogLine({ level, message, timestamp });
  }

  info(message: string): void {
    this.write('INFO', message);
  }

  warn(message: string): void {
    this.write('WARN', message);
  }

  error(message: string): void {
    this.write('ERROR', message);
  }
}
