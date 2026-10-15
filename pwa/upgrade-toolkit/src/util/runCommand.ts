import { execFile } from 'child_process';

export interface RunCommandResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

export function runCommand(
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; timeoutMs?: number; cwd?: string } = {}
): Promise<RunCommandResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { env: options.env, timeout: options.timeoutMs, cwd: options.cwd, maxBuffer: 1024 * 1024 * 64 },
      (err: any, stdout, stderr) => {
        if (err) {
          resolve({
            success: false,
            exitCode: typeof err.code === 'number' ? err.code : null,
            stdout: stdout?.toString() ?? '',
            stderr: stderr?.toString() ?? '',
            error: (stderr?.toString() || err.message || '').trim(),
          });
        } else {
          resolve({ success: true, exitCode: 0, stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' });
        }
      }
    );
  });
}
