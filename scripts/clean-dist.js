#!/usr/bin/env node

const { rimraf } = require('rimraf');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist-installer');

console.log('Cleaning dist-installer directory...');

// Use rimraf with promise-based API (v6+)
rimraf(distPath, { 
  maxRetries: 5, 
  retryDelay: 2000 
})
  .then(() => {
    console.log('✓ Cleaned dist-installer directory');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n⚠️  Warning: Could not clean dist-installer directory.');
    console.error('   This usually means an Electron app is still running.');
    console.error('   Please close all Electron instances and try again.');
    console.error('   Error:', err.message);
    console.error('\n   You can also skip the clean step and run:');
    console.error('   npm run build:frontend && npm run build:backend && npm run build:electron && npm run install:backend:prod && npm run prune:backend && npx electron-builder --win --publish never');
    process.exit(1);
  });

