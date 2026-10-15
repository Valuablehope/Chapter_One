import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Build of the on-device (Capacitor) app. The desktop build (vite.config.ts) is untouched.
// The backend runs inside the app against an on-device database; see ../mobile-core.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@c1/mobile-core': path.resolve(__dirname, '../mobile-core/dist/localApi.js'),
    },
  },
  server: { host: '127.0.0.1', port: 5274, strictPort: true, fs: { allow: ['..'] } },
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  build: {
    outDir: 'dist-mobile',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: { input: path.resolve(__dirname, 'mobile.html') },
  },
  worker: { format: 'es' },
});
