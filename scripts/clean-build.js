#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const directoriesToClean = [
  'frontend/dist',
  'frontend/node_modules/.vite',
  'backend/dist',
  'electron/dist',
];

console.log('Cleaning build directories...');

let cleanedCount = 0;
let errorCount = 0;

directoriesToClean.forEach((dir) => {
  const fullPath = path.join(__dirname, '..', dir);
  try {
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`✓ Cleaned ${dir}`);
      cleanedCount++;
    }
  } catch (err) {
    console.error(`✗ Failed to clean ${dir}: ${err.message}`);
    errorCount++;
  }
});

if (errorCount === 0) {
  console.log(`\n✓ Successfully cleaned ${cleanedCount} director${cleanedCount === 1 ? 'y' : 'ies'}`);
  process.exit(0);
} else {
  console.error(`\n⚠️  Completed with ${errorCount} error(s)`);
  process.exit(1);
}

