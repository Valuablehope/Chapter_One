import fs from 'fs';
import os from 'os';
import path from 'path';
import forge from 'node-forge';
import { Express, NextFunction, Request, Response } from 'express';
import express from 'express';
import { logger } from '../utils/logger';

/**
 * LAN mode: lets phones/tablets on the store network reach this backend over HTTPS
 * and load the PWA from it. Entirely opt-in (LAN_MODE=true); with it off, none of
 * this code runs and the server stays bound to 127.0.0.1 exactly as before.
 */

export const CA_COMMON_NAME = 'Chapter One POS Local CA';
const CA_FILE = 'ca.crt';
const CA_KEY_FILE = 'ca.key';
const LEAF_CERT_FILE = 'server.crt';
const LEAF_KEY_FILE = 'server.key';
const META_FILE = 'meta.json';
const CA_YEARS = 10;
// Apple rejects trusted server certs valid for more than 398 days.
const LEAF_DAYS = 397;
const RENEW_BEFORE_DAYS = 30;

export function isLanMode(): boolean {
  return String(process.env.LAN_MODE || '').toLowerCase() === 'true';
}

export function getLanPorts(): { http: number; https: number } {
  return {
    http: Number(process.env.PORT || process.env.API_PORT || 3101),
    https: Number(process.env.HTTPS_PORT || 3443),
  };
}

/** LAN mode listens on every interface; LAN_BIND_HOST narrows it (e.g. 127.0.0.1 for local testing). */
export function getBindHost(): string {
  if (!isLanMode()) return '127.0.0.1';
  return process.env.LAN_BIND_HOST || '0.0.0.0';
}

/** Non-loopback IPv4 addresses of this machine. */
export function getLanIPv4Addresses(): string[] {
  const out: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    }
  }
  return out;
}

function getCertDir(): string {
  if (process.env.LAN_CERT_DIR) return process.env.LAN_CERT_DIR;
  if (process.env.USER_DATA_PATH) return path.join(process.env.USER_DATA_PATH, 'lan');
  return path.resolve(__dirname, '../../.lan');
}

/** Every name/IP the server certificate must be valid for. */
function getCertHosts(): { dns: string[]; ips: string[] } {
  const dns = new Set<string>(['localhost']);
  const host = os.hostname();
  if (host) {
    dns.add(host);
    dns.add(`${host}.local`);
  }
  for (const extra of String(process.env.LAN_EXTRA_HOSTS || '').split(',')) {
    const v = extra.trim();
    if (v && !/^\d+\.\d+\.\d+\.\d+$/.test(v)) dns.add(v);
  }
  const ips = new Set<string>(['127.0.0.1', ...getLanIPv4Addresses()]);
  for (const extra of String(process.env.LAN_EXTRA_HOSTS || '').split(',')) {
    const v = extra.trim();
    if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) ips.add(v);
  }
  return { dns: [...dns].sort(), ips: [...ips].sort() };
}

interface CertMeta {
  hosts: { dns: string[]; ips: string[] };
  leafNotAfter: string;
}

function randomSerial(): string {
  // Positive 16-byte serial (top bit cleared).
  const hex = forge.util.bytesToHex(forge.random.getBytesSync(16));
  return '0' + hex.slice(1);
}

function loadOrCreateCa(dir: string): { cert: forge.pki.Certificate; key: forge.pki.rsa.PrivateKey } {
  const caCertPath = path.join(dir, CA_FILE);
  const caKeyPath = path.join(dir, CA_KEY_FILE);
  if (fs.existsSync(caCertPath) && fs.existsSync(caKeyPath)) {
    const cert = forge.pki.certificateFromPem(fs.readFileSync(caCertPath, 'utf8'));
    if (cert.validity.notAfter.getTime() > Date.now() + 30 * 86400000) {
      return { cert, key: forge.pki.privateKeyFromPem(fs.readFileSync(caKeyPath, 'utf8')) as forge.pki.rsa.PrivateKey };
    }
    logger.warn('LAN CA is about to expire; generating a new one. Devices will need to install the new CA.');
  }
  logger.info('🔐 Generating local certificate authority (one-time)...');
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerial();
  cert.validity.notBefore = new Date(Date.now() - 86400000);
  cert.validity.notAfter = new Date(Date.now() + CA_YEARS * 365 * 86400000);
  const attrs = [
    { name: 'commonName', value: CA_COMMON_NAME },
    { name: 'organizationName', value: 'Chapter One' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  fs.writeFileSync(caCertPath, forge.pki.certificateToPem(cert));
  fs.writeFileSync(caKeyPath, forge.pki.privateKeyToPem(keys.privateKey), { mode: 0o600 });
  return { cert, key: keys.privateKey };
}

function createLeaf(
  dir: string,
  ca: { cert: forge.pki.Certificate; key: forge.pki.rsa.PrivateKey },
  hosts: { dns: string[]; ips: string[] }
): void {
  logger.info('🔐 Issuing server certificate', { dns: hosts.dns, ips: hosts.ips });
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerial();
  cert.validity.notBefore = new Date(Date.now() - 86400000);
  cert.validity.notAfter = new Date(Date.now() + LEAF_DAYS * 86400000);
  cert.setSubject([{ name: 'commonName', value: hosts.dns[0] === 'localhost' ? (hosts.dns[1] || 'localhost') : hosts.dns[0] }]);
  cert.setIssuer(ca.cert.subject.attributes);
  const altNames = [
    ...hosts.dns.map((value) => ({ type: 2, value })),
    ...hosts.ips.map((ip) => ({ type: 7, ip })),
  ];
  cert.setExtensions([
    { name: 'basicConstraints', cA: false, critical: true },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames },
  ]);
  cert.sign(ca.key, forge.md.sha256.create());
  fs.writeFileSync(path.join(dir, LEAF_CERT_FILE), forge.pki.certificateToPem(cert));
  fs.writeFileSync(path.join(dir, LEAF_KEY_FILE), forge.pki.privateKeyToPem(keys.privateKey), { mode: 0o600 });
  const meta: CertMeta = { hosts, leafNotAfter: cert.validity.notAfter.toISOString() };
  fs.writeFileSync(path.join(dir, META_FILE), JSON.stringify(meta, null, 2));
}

export interface LanCertificates {
  dir: string;
  caCertPem: string;
  cert: string;
  key: string;
}

/** Creates the CA and/or server certificate when missing, expiring or when this machine's addresses changed. */
export function ensureCertificates(): LanCertificates {
  const dir = getCertDir();
  fs.mkdirSync(dir, { recursive: true });
  const hosts = getCertHosts();
  const ca = loadOrCreateCa(dir);

  let needLeaf = true;
  try {
    const meta: CertMeta = JSON.parse(fs.readFileSync(path.join(dir, META_FILE), 'utf8'));
    const sameHosts = JSON.stringify(meta.hosts) === JSON.stringify(hosts);
    const notExpiring = new Date(meta.leafNotAfter).getTime() > Date.now() + RENEW_BEFORE_DAYS * 86400000;
    // The leaf must also have been issued by the CA currently on disk.
    const leaf = forge.pki.certificateFromPem(fs.readFileSync(path.join(dir, LEAF_CERT_FILE), 'utf8'));
    const issuedByCa = ca.cert.verify(leaf);
    needLeaf = !(sameHosts && notExpiring && issuedByCa);
  } catch {
    needLeaf = true;
  }
  if (needLeaf) createLeaf(dir, ca, hosts);

  return {
    dir,
    caCertPem: fs.readFileSync(path.join(dir, CA_FILE), 'utf8'),
    cert: fs.readFileSync(path.join(dir, LEAF_CERT_FILE), 'utf8'),
    key: fs.readFileSync(path.join(dir, LEAF_KEY_FILE), 'utf8'),
  };
}

function isLoopback(addr: string | undefined): boolean {
  if (!addr) return false;
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function frontendDistDir(): string | null {
  const candidates = [
    process.env.FRONTEND_DIST,
    path.resolve(__dirname, '../../../frontend/dist'),
    path.resolve(__dirname, '../../../../frontend/dist'),
  ].filter(Boolean) as string[];
  return candidates.find((p) => fs.existsSync(path.join(p, 'index.html'))) || null;
}

/** Origins the PWA can legitimately come from: this machine's own addresses and names. */
export function isLanOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    const { dns, ips } = getCertHosts();
    return dns.includes(host) || ips.includes(host);
  } catch {
    return false;
  }
}

function landingPage(httpsPort: number): string {
  const ips = getLanIPv4Addresses();
  const urls = ips.map((ip) => `https://${ip}:${httpsPort}/`);
  const list = urls.map((u) => `<li><a href="${u}">${u}</a></li>`).join('') || '<li>No network address found.</li>';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chapter One - Connect this device</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px 16px}code{background:#eef;padding:1px 5px;border-radius:4px}a.btn{display:inline-block;background:#1f4fd8;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;margin:8px 0}</style></head><body>
<h1>Connect this device</h1>
<p>1. Install the store certificate so this device trusts the POS.</p>
<p><a class="btn" href="/lan/ca.crt">Download certificate</a></p>
<ul>
<li><b>iPhone / iPad:</b> open the downloaded profile in Settings, install it, then go to Settings &gt; General &gt; About &gt; Certificate Trust Settings and enable <code>${CA_COMMON_NAME}</code>.</li>
<li><b>Android:</b> Settings &gt; Security &gt; Encryption &amp; credentials &gt; Install a certificate &gt; CA certificate.</li>
<li><b>Windows / Mac:</b> open the file and add it to Trusted Root Certification Authorities.</li>
</ul>
<p>2. Open the POS at one of these addresses:</p>
<ul>${list}</ul>
</body></html>`;
}

/**
 * Routes and middleware that must run before the normal app setup:
 * /lan landing page + CA download, HTTP->HTTPS redirect for remote clients,
 * and the built PWA served from the same origin as the API.
 */
export function mountLanFirst(app: Express): void {
  const { https: httpsPort } = getLanPorts();

  app.get('/lan', (_req: Request, res: Response) => {
    res.type('html').send(landingPage(httpsPort));
  });
  app.get('/lan/ca.crt', (_req: Request, res: Response) => {
    const dir = getCertDir();
    const file = path.join(dir, CA_FILE);
    if (!fs.existsSync(file)) {
      res.status(503).type('text').send('Certificate not generated yet.');
      return;
    }
    res.setHeader('Content-Type', 'application/x-x509-ca-cert');
    res.setHeader('Content-Disposition', 'attachment; filename="chapter-one-local-ca.crt"');
    res.send(fs.readFileSync(file));
  });

  // Remote clients on plain HTTP are sent to HTTPS (camera + PWA install need a secure context).
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.secure || isLoopback(req.socket.remoteAddress) || req.path === '/health') return next();
    const host = (req.headers.host || '').replace(/:\d+$/, '');
    res.redirect(308, `https://${host}:${httpsPort}${req.originalUrl}`);
  });

  const dist = frontendDistDir();
  if (dist) {
    logger.info(`📱 Serving PWA from ${dist}`);
    app.use(express.static(dist, { index: 'index.html', maxAge: 0 }));
  } else {
    logger.warn('LAN mode is on but frontend/dist was not found. Run "npm run build" in pwa/frontend to serve the PWA.');
  }
}
