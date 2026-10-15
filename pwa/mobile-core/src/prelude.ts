/**
 * Must be the first import of the bundle: the backend modules read process.env at load time
 * (JWT secret, bcrypt rounds), and there is no `process` in a WebView.
 */
const store = (() => {
  try { return globalThis.localStorage; } catch { return undefined; }
})();

function deviceSecret(): string {
  const key = 'c1_device_jwt_secret';
  let v = store?.getItem(key) || null;
  if (!v) {
    const b = new Uint8Array(48);
    globalThis.crypto.getRandomValues(b);
    v = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    try { store?.setItem(key, v); } catch { /* private mode: secret lives for this session only */ }
  }
  return v;
}

const g: any = globalThis;
// The bundle reads env from __c1env (see scripts/build.mjs); there is no real `process` on device.
g.__c1env = g.__c1env || {};
Object.assign(g.__c1env, {
  NODE_ENV: 'production',
  JWT_SECRET: deviceSecret(),
  JWT_EXPIRY: '24h',
  BCRYPT_ROUNDS: '10',
  RUNTIME: 'device',
});
export {};
