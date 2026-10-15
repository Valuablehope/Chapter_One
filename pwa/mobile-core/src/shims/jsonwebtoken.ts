import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

/** Synchronous HS256 sign/verify (the backend's token helpers are synchronous, WebCrypto is not). */
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function parseExpiry(v: string | number | undefined): number | null {
  if (v === undefined) return null;
  if (typeof v === 'number') return v;
  const m = /^(\d+)\s*([smhd]?)$/.exec(v.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n * ({ s: 1, m: 60, h: 3600, d: 86400, '': 1 } as any)[m[2]];
}
const sign256 = (data: string, secret: string) => b64url(hmac(sha256, enc.encode(secret), enc.encode(data)));

export function sign(payload: Record<string, any>, secret: string, options: { expiresIn?: string | number } = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const body: Record<string, any> = { ...payload, iat: now };
  const ttl = parseExpiry(options.expiresIn);
  if (ttl) body.exp = now + ttl;
  const head = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const data = `${head}.${b64url(enc.encode(JSON.stringify(body)))}`;
  return `${data}.${sign256(data, secret)}`;
}

export function verify(token: string, secret: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('jwt malformed');
  const expected = sign256(`${parts[0]}.${parts[1]}`, secret);
  if (expected.length !== parts[2].length || expected !== parts[2]) throw new Error('invalid signature');
  const payload = JSON.parse(dec.decode(b64urlDecode(parts[1])));
  if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) throw new Error('jwt expired');
  return payload;
}

export function decode(token: string): any {
  try { return JSON.parse(dec.decode(b64urlDecode(token.split('.')[1]))); } catch { return null; }
}

export default { sign, verify, decode };
