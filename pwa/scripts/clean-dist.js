#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist-installer');

console.log('Cleaning dist-installer directory...');

try {
  // Use Node.js built-in fs.rmSync (available in Node 14.14.0+)
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 2000 });
  }
  console.log('✓ Cleaned dist-installer directory');
  process.exit(0);
} catch (err) {
  console.error('\n⚠️  Warning: Could not clean dist-installer directory.');
  console.error('   This usually means an Electron app is still running.');
  console.error('   Please close all Electron instances and try again.');
  console.error('   Error:', err.message);
  console.error('\n   You can also skip the clean step and run:');
  console.error('   npm run build:frontend && npm run build:backend && npm run build:electron && npm run install:backend:prod && npm run prune:backend && npx electron-builder --win --publish never');
  process.exit(1);
}

