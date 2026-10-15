import { sha256 } from '@noble/hashes/sha2.js';

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export function createHash(alg: string) {
  if (alg !== 'sha256') throw new Error(`createHash(${alg}) is not supported on device`);
  const chunks: Uint8Array[] = [];
  const api = {
    update(d: string | Uint8Array) { chunks.push(typeof d === 'string' ? new TextEncoder().encode(d) : d); return api; },
    digest(enc?: string) {
      const len = chunks.reduce((n, c) => n + c.length, 0);
      const all = new Uint8Array(len);
      let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
      const out = sha256(all);
      return enc === 'hex' ? toHex(out) : out;
    },
  };
  return api;
}
export function randomBytes(n: number) {
  const b = new Uint8Array(n); globalThis.crypto.getRandomValues(b);
  return Object.assign(b, { toString: (enc?: string) => (enc === 'hex' ? toHex(b) : String.fromCharCode(...b)) });
}
export const randomUUID = () => globalThis.crypto.randomUUID();
export default { createHash, randomBytes, randomUUID };
