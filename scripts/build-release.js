const { execSync } = require('child_process');

// A wrapper script to call electron-builder
try {
  console.log('Building Electron Windows Installer...');
  execSync('npx electron-builder --win -c package.json', { stdio: 'inherit', cwd: process.cwd() });
  console.log('Build complete.');
} catch (error) {
  console.error('Build failed.');
  process.exit(1);
}
