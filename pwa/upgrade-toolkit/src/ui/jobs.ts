import { logBus, LogEntry } from '../logging/logBus';

export interface JobResult {
  status: 'success' | 'error';
  message: string;
  data?: any;
}

export interface Job {
  id: string;
  action: string;
  status: 'running' | 'success' | 'error';
  lines: LogEntry[];
  result?: JobResult;
}

// Only one job runs at a time — every action here shares the same live
// database/app install, so running two at once would be actively dangerous
// (e.g. a backup starting mid-restore). This also means log lines never
// need to be routed by job id: whichever job is "current" owns the bus.
let currentJob: Job | null = null;
let jobCounter = 0;

export function getCurrentJob(): Job | null {
  return currentJob;
}

export function isJobRunning(): boolean {
  return currentJob !== null && currentJob.status === 'running';
}

export function startJob(action: string, run: () => Promise<any>): Job {
  if (isJobRunning()) {
    throw new Error(`A job (${currentJob!.action}) is already running. Wait for it to finish before starting another.`);
  }

  jobCounter += 1;
  const job: Job = { id: String(jobCounter), action, status: 'running', lines: [] };
  currentJob = job;

  const onLine = (entry: LogEntry) => {
    job.lines.push(entry);
  };
  logBus.on('line', onLine);

  run()
    .then((data) => {
      job.status = 'success';
      job.result = { status: 'success', message: 'Completed.', data };
    })
    .catch((err: any) => {
      job.status = 'error';
      job.result = { status: 'error', message: err?.message || String(err) };
      job.lines.push({ level: 'ERROR', message: job.result.message, timestamp: new Date().toISOString() });
    })
    .finally(() => {
      logBus.off('line', onLine);
    });

  return job;
}
