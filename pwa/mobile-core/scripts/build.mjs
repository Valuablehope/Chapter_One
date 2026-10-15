import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const shim = (n) => path.join(root, 'src/shims', n);
const target = process.argv[2] === 'node' ? 'node' : 'browser';

const SHIMMED = {
  express: 'express.ts',
  jsonwebtoken: 'jsonwebtoken.ts',
  crypto: 'crypto.ts',
  path: 'path.ts',
  fs: 'fs.ts',
  os: 'os.ts',
  net: 'net.ts',
  dotenv: 'dotenv.ts',
  multer: 'multer.ts',
  'express-rate-limit': 'express-rate-limit.ts',
  pg: 'pg.ts',
};

const aliasPlugin = {
  name: 'device-alias',
  setup(b) {
    // Backend files import the pool with a relative path; swap it for the PGlite pool.
    b.onResolve({ filter: /(^|\/)config\/database$/ }, () => ({ path: shim('database.ts') }));
    if (target === 'browser') {
      b.onResolve({ filter: /^node:(module|fs|path|os|url|crypto)$/ }, () => ({ path: shim('empty.ts') }));
    }
    b.onResolve({ filter: /^(node:)?(express|jsonwebtoken|crypto|path|fs|os|net|dotenv|multer|express-rate-limit|pg)$/ }, (a) => ({
      path: shim(SHIMMED[a.path.replace(/^node:/, '')]),
    }));
  },
};

await build({
  entryPoints: [path.join(root, 'src/localApi.ts')],
  outfile: path.join(root, target === 'node' ? 'dist/localApi.node.mjs' : 'dist/localApi.js'),
  bundle: true,
  format: 'esm',
  platform: target === 'node' ? 'node' : 'browser',
  target: 'es2022',
  sourcemap: true,
  minify: false,
  logLevel: 'info',
  plugins: [aliasPlugin],
  // PGlite stays a package import so the app bundler (Vite) resolves its wasm/data assets itself.
  external: ['@electric-sql/pglite', '@electric-sql/pglite/contrib/*'],
  loader: { '.wasm': 'file', '.data': 'file' },
  // Backend files look up .env relative to __dirname; there is no filesystem on device.
  // Read env from globalThis.__c1env (set by src/prelude.ts). Without this the app bundler would
  // freeze `process.env` to an empty object at build time.
  define: {
    __dirname: '"/"',
    __filename: '"/index.js"',
    'process.env.NODE_ENV': '"production"',
    'process.env': 'globalThis.__c1env',
  },
});
