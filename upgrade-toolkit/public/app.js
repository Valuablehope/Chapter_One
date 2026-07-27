let currentRunDir = null;
let pollTimer = null;
let sinceLine = 0;

const $ = (sel) => document.querySelector(sel);
const logPanel = $('#log-panel');
const jobBanner = $('#job-banner');

function overrides() {
  const val = (id) => $(id).value.trim();
  const out = {};
  if (val('#ov-envPath')) out.envPath = val('#ov-envPath');
  if (val('#ov-installDir')) out.installDir = val('#ov-installDir');
  if (val('#ov-pgBinDir')) out.pgBinDir = val('#ov-pgBinDir');
  return out;
}

$('#overrides-toggle').addEventListener('click', () => {
  $('#overrides-body').classList.toggle('hidden');
});

document.querySelectorAll('button[data-browse]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const kind = btn.dataset.browse;
    const targetId = btn.dataset.target;
    const filter = btn.dataset.filter === 'exe' ? 'Installer (*.exe)|*.exe|All files (*.*)|*.*' : undefined;
    const url = kind === 'file' ? `/api/browse/file${filter ? '?filter=' + encodeURIComponent(filter) : ''}` : '/api/browse/folder';
    btn.disabled = true;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.path) {
        document.getElementById(targetId).value = data.path;
      }
    } finally {
      btn.disabled = false;
    }
  });
});

function setButtonsEnabled(enabled) {
  document.querySelectorAll('.action-btn, #new-run-btn, button[data-browse]').forEach((b) => (b.disabled = !enabled));
}

function badgeEl(step) {
  return document.getElementById('badge-' + step);
}

function renderBadge(step, state) {
  const el = badgeEl(step);
  if (!el) return;
  const stepState = state.steps[step];
  if (!stepState) {
    el.textContent = 'pending';
    el.className = 'step-badge';
    return;
  }
  if (step === 'verifyBackup' && stepState.verified === false) {
    el.textContent = 'failed';
    el.className = 'step-badge failed';
    return;
  }
  if (step === 'upgrade' && stepState.migrateExitCode !== 0) {
    el.textContent = 'failed';
    el.className = 'step-badge failed';
    return;
  }
  if (step === 'postVerify' && stepState.passed === false) {
    el.textContent = 'failed';
    el.className = 'step-badge failed';
    return;
  }
  el.textContent = 'done';
  el.className = 'step-badge done';
}

async function refreshStatus() {
  if (!currentRunDir) return;
  const res = await fetch(`/api/status?runDir=${encodeURIComponent(currentRunDir)}`);
  if (!res.ok) return;
  const { state } = await res.json();
  ['backup', 'verifyBackup', 'offsiteCopy', 'upgrade', 'postVerify', 'rollback'].forEach((s) => renderBadge(s, state));
}

async function refreshRuns() {
  const res = await fetch('/api/runs');
  const { runs } = await res.json();
  const list = $('#runs-list');
  list.innerHTML = '';
  if (runs.length === 0) {
    list.innerHTML = '<p class="hint">No runs yet. Start one with Preflight below.</p>';
    return;
  }
  for (const run of runs) {
    const div = document.createElement('div');
    div.className = 'run-entry';
    const doneCount = Object.values(run.steps).filter(Boolean).length;
    div.innerHTML = `
      <div class="run-info">
        <div>${new Date(run.createdAt).toLocaleString()} — ${doneCount}/6 steps done</div>
        <div class="run-dir mono">${run.runDir}</div>
      </div>
      <button data-select-run="${encodeURIComponent(run.runDir)}">Select</button>
    `;
    list.appendChild(div);
  }
  document.querySelectorAll('button[data-select-run]').forEach((btn) => {
    btn.addEventListener('click', () => selectRun(decodeURIComponent(btn.dataset.selectRun)));
  });
}

function selectRun(runDir) {
  currentRunDir = runDir;
  $('#current-run-dir').textContent = runDir;
  $('#workflow-card').classList.remove('hidden');
  refreshStatus();
}

$('#new-run-btn').addEventListener('click', () => runAction('preflight', '/api/preflight', overrides()));

document.querySelectorAll('button[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    if (!currentRunDir) {
      alert('Select or start a run first.');
      return;
    }
    let body = { runDir: currentRunDir, ...overrides() };
    if (action === 'backup') {
      body.force = $('#backup-force').checked;
    } else if (action === 'offsite-copy') {
      body.dest = $('#offsite-dest').value.trim();
      if (!body.dest) return alert('Enter or browse to a destination first.');
    } else if (action === 'upgrade') {
      body.installerPath = $('#upgrade-installer').value.trim();
      body.expectedVersion = $('#upgrade-expected-version').value.trim() || undefined;
      body.force = $('#upgrade-force').checked;
      if (!body.installerPath) return alert('Choose the new version installer first.');
    } else if (action === 'rollback') {
      body.previousInstallerPath = $('#rollback-installer').value.trim() || undefined;
      body.confirm = $('#rollback-confirm').checked;
      if (!body.confirm) return alert('Check the confirmation box first — rollback drops and recreates the live database.');
    }
    const endpoint = '/api/' + action;
    runAction(action, endpoint, body);
  });
});

async function runAction(action, endpoint, body) {
  setButtonsEnabled(false);
  logPanel.textContent = '';
  jobBanner.className = 'running';
  jobBanner.textContent = `Running: ${action}…`;
  jobBanner.classList.remove('hidden');
  sinceLine = 0;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    jobBanner.className = 'error';
    jobBanner.textContent = `Could not start ${action}: ${err.error}`;
    setButtonsEnabled(true);
    return;
  }

  poll(action);
}

function poll(action) {
  clearTimeout(pollTimer);
  const tick = async () => {
    const res = await fetch(`/api/jobs/current?since=${sinceLine}`);
    const job = await res.json();
    if (job.lines && job.lines.length > 0) {
      for (const line of job.lines) {
        logPanel.textContent += `[${line.level}] ${line.message}\n`;
      }
      sinceLine = job.totalLines;
      logPanel.scrollTop = logPanel.scrollHeight;
    }

    if (job.status === 'running') {
      pollTimer = setTimeout(tick, 700);
      return;
    }

    // Job finished.
    if (job.status === 'success') {
      jobBanner.className = 'success';
      jobBanner.textContent = `${action} completed successfully.`;
      if (action === 'preflight' && job.result && job.result.data) {
        selectRun(job.result.data);
        refreshRuns();
      } else {
        refreshStatus();
        refreshRuns();
      }
    } else {
      jobBanner.className = 'error';
      jobBanner.textContent = `${action} failed: ${job.result ? job.result.message : 'unknown error'}`;
      refreshStatus();
    }
    setButtonsEnabled(true);
  };
  tick();
}

refreshRuns();
