import express from 'express';
import * as path from 'path';
import { exec } from 'child_process';
import { GlobalOptions } from '../context';
import { readState } from '../state';
import { listRuns } from './runs';
import { pickFile, pickFolder } from './browse';
import { startJob, getCurrentJob, isJobRunning } from './jobs';
import {
  actionPreflight,
  actionBackup,
  actionVerifyBackup,
  actionOffsiteCopy,
  actionUpgrade,
  actionPostVerify,
  actionRollback,
} from '../actions';

const PORT = parseInt(process.env.PORT || '5757', 10);
const DEFAULT_BACKUPS_ROOT = path.join(__dirname, '..', '..', 'backups');
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function globalOptsFromBody(body: any): GlobalOptions {
  return {
    envPath: body.envPath || undefined,
    installDir: body.installDir || undefined,
    pgBinDir: body.pgBinDir || undefined,
  };
}

function requireIdleJob(res: express.Response): boolean {
  if (isJobRunning()) {
    res.status(409).json({ error: 'A job is already running. Wait for it to finish.' });
    return false;
  }
  return true;
}

app.get('/api/runs', (req, res) => {
  const backupsRoot = (req.query.backupsRoot as string) || DEFAULT_BACKUPS_ROOT;
  res.json({ runs: listRuns(backupsRoot), defaultBackupsRoot: DEFAULT_BACKUPS_ROOT });
});

app.get('/api/status', (req, res) => {
  try {
    const state = readState(req.query.runDir as string);
    res.json({ state });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/browse/file', async (req, res) => {
  try {
    const filter = (req.query.filter as string) || 'Installer (*.exe)|*.exe|All files (*.*)|*.*';
    const filePath = await pickFile(filter);
    res.json({ path: filePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/browse/folder', async (req, res) => {
  try {
    const folderPath = await pickFolder();
    res.json({ path: folderPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs/current', (req, res) => {
  const job = getCurrentJob();
  if (!job) {
    res.json({ job: null });
    return;
  }
  const since = parseInt((req.query.since as string) || '0', 10);
  res.json({
    id: job.id,
    action: job.action,
    status: job.status,
    lines: job.lines.slice(since),
    totalLines: job.lines.length,
    result: job.status === 'running' ? undefined : job.result,
  });
});

app.post('/api/preflight', (req, res) => {
  if (!requireIdleJob(res)) return;
  const body = req.body || {};
  const job = startJob('preflight', () =>
    actionPreflight({
      backupsRoot: body.backupsRoot || DEFAULT_BACKUPS_ROOT,
      envPath: body.envPath || undefined,
      installDir: body.installDir || undefined,
      pgBinDir: body.pgBinDir || undefined,
    })
  );
  res.json({ jobId: job.id });
});

app.post('/api/backup', (req, res) => {
  if (!requireIdleJob(res)) return;
  const body = req.body || {};
  if (!body.runDir) {
    res.status(400).json({ error: 'runDir is required' });
    return;
  }
  const job = startJob('backup', () => actionBackup(body.runDir, globalOptsFromBody(body), !!body.force));
  res.json({ jobId: job.id });
});

app.post('/api/verify-backup', (req, res) => {
  if (!requireIdleJob(res)) return;
  const body = req.body || {};
  if (!body.runDir) {
    res.status(400).json({ error: 'runDir is required' });
    return;
  }
  const job = startJob('verify-backup', () => actionVerifyBackup(body.runDir, globalOptsFromBody(body)));
  res.json({ jobId: job.id });
});

app.post('/api/offsite-copy', (req, res) => {
  if (!requireIdleJob(res)) return;
  const body = req.body || {};
  if (!body.runDir || !body.dest) {
    res.status(400).json({ error: 'runDir and dest are required' });
    return;
  }
  const job = startJob('offsite-copy', () => actionOffsiteCopy(body.runDir, body.dest));
  res.json({ jobId: job.id });
});

app.post('/api/upgrade', (req, res) => {
  if (!requireIdleJob(res)) return;
  const body = req.body || {};
  if (!body.runDir || !body.installerPath) {
    res.status(400).json({ error: 'runDir and installerPath are required' });
    return;
  }
  const job = startJob('upgrade', () =>
    actionUpgrade(body.runDir, globalOptsFromBody(body), body.installerPath, body.expectedVersion || undefined, !!body.force)
  );
  res.json({ jobId: job.id });
});

app.post('/api/post-verify', (req, res) => {
  if (!requireIdleJob(res)) return;
  const body = req.body || {};
  if (!body.runDir) {
    res.status(400).json({ error: 'runDir is required' });
    return;
  }
  const job = startJob('post-verify', () => actionPostVerify(body.runDir, globalOptsFromBody(body)));
  res.json({ jobId: job.id });
});

app.post('/api/rollback', (req, res) => {
  if (!requireIdleJob(res)) return;
  const body = req.body || {};
  if (!body.runDir) {
    res.status(400).json({ error: 'runDir is required' });
    return;
  }
  if (body.confirm !== true) {
    res.status(400).json({ error: 'Rollback requires confirm: true — this is destructive.' });
    return;
  }
  const job = startJob('rollback', () => actionRollback(body.runDir, globalOptsFromBody(body), body.previousInstallerPath || undefined));
  res.json({ jobId: job.id });
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Chapter One Upgrade Toolkit UI running at ${url}`);
  exec(`start "" "${url}"`);
});
