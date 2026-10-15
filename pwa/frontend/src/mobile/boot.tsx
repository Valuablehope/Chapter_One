import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import axios, { AxiosError } from 'axios';
import {
  openDeviceDatabase,
  isDeviceSetUp,
  setupDevice,
  createLocalApi,
  type SetupInput,
} from '@c1/mobile-core';
import { api } from '../services/api';

/**
 * Entry for the on-device app. The backend runs in-process against a local database, so this
 * opens (or creates) that database, runs first-time setup, points the app's API client at it,
 * and only then loads the normal app (src/main.tsx).
 */

const DB_DIR = 'idb://chapter-one';

// The app stylesheet loads with the app itself; the setup/splash screens need their own base look.
document.body.style.margin = '0';
document.body.style.fontFamily = "'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";

function createLocalAdapter(local: ReturnType<typeof createLocalApi>): AxiosAdapter {
  return async (config) => {
    // axios gives the final URL (baseURL + url + params); the local API only needs path + query.
    const full = new URL(axios.getUri(config), 'http://device.local');
    const headers: Record<string, string> = {};
    const h: any = config.headers;
    const plain = h?.toJSON ? h.toJSON() : h || {};
    for (const k of Object.keys(plain)) {
      const v = plain[k];
      if (typeof v === 'string') headers[k] = v;
    }
    let body: unknown = config.data;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        /* leave as text */
      }
    }
    const res = await local.request({
      method: String(config.method || 'get'),
      url: full.pathname + full.search,
      headers,
      body,
    });
    const response: AxiosResponse = {
      data: res.body,
      status: res.status,
      statusText: String(res.status),
      headers: res.headers,
      config,
      request: {},
    };
    const ok = config.validateStatus ? config.validateStatus(res.status) : res.status >= 200 && res.status < 300;
    if (ok) return response;
    throw new AxiosError(
      `Request failed with status code ${res.status}`,
      res.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      response.request,
      response
    );
  };
}

function SetupScreen({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState<SetupInput>({
    storeName: '',
    adminUsername: 'admin',
    adminFullName: '',
    adminPassword: '',
    mode: 'standalone',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof SetupInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.storeName.trim() || !form.adminUsername.trim() || form.adminPassword.length < 6) {
      setError('Enter a store name, a username and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      await setupDevice({ ...form, storeName: form.storeName.trim(), adminUsername: form.adminUsername.trim() });
      onDone();
    } catch (err: any) {
      setError(err?.message || 'Setup failed.');
      setBusy(false);
    }
  };

  const field: React.CSSProperties = {
    width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 16, boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', margin: '14px 0 6px' };
  return (
    <div
      style={{
        minHeight: '100dvh', background: '#0f1c2e', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 16, boxSizing: 'border-box',
      }}
    >
      <form onSubmit={submit} style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Set up this device</h1>
        <p style={{ color: '#64748b', margin: '6px 0 0', fontSize: 14 }}>
          Everything is stored on this device. You can sell without a network.
        </p>
        <label style={label} htmlFor="storeName">Store name</label>
        <input id="storeName" style={field} value={form.storeName} onChange={set('storeName')} autoComplete="organization" />
        <label style={label} htmlFor="adminUsername">Admin username</label>
        <input
          id="adminUsername" style={field} value={form.adminUsername} onChange={set('adminUsername')}
          autoCapitalize="none" autoComplete="username"
        />
        <label style={label} htmlFor="adminPassword">Admin password</label>
        <input
          id="adminPassword" type="password" style={field} value={form.adminPassword}
          onChange={set('adminPassword')} autoComplete="new-password"
        />
        <label style={label} htmlFor="mode">Mode</label>
        <select id="mode" style={field} value={form.mode} onChange={set('mode')}>
          <option value="standalone">Standalone: this device is the whole store</option>
          <option value="linked">Linked: sync with the main PC (coming soon)</option>
        </select>
        {error && (
          <p role="alert" style={{ color: '#b91c1c', fontSize: 14 }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 20, width: '100%', padding: 14, border: 0, borderRadius: 10,
            background: '#1f4fd8', color: '#fff', fontSize: 16, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          {busy ? 'Setting up...' : 'Create store'}
        </button>
      </form>
    </div>
  );
}

function Splash({ text }: { text: string }) {
  return (
    <div
      style={{
        minHeight: '100dvh', background: '#0f1c2e', color: '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: 16,
      }}
    >
      {text}
    </div>
  );
}

async function start() {
  const rootEl = document.getElementById('root') as HTMLElement;
  const root = ReactDOM.createRoot(rootEl);
  root.render(<Splash text="Opening database..." />);

  try {
    await openDeviceDatabase({ dataDir: DB_DIR });
    if (!(await isDeviceSetUp())) {
      await new Promise<void>((resolve) => root.render(<SetupScreen onDone={resolve} />));
    }
    root.unmount();
    api.defaults.adapter = createLocalAdapter(createLocalApi());
    // The normal app mounts itself on import; the local API is already in place by now.
    await import('../main');
  } catch (err: any) {
    root.render(<Splash text={`Could not start: ${err?.message || err}`} />);
    console.error(err);
  }
}

start();
