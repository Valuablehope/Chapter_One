const { execSync } = require('child_process');
const path = require('path');

const version = process.env.RELEASE_VERSION;
const user = process.env.SSH_USER;
const host = process.env.SSH_HOST;
const port = process.env.SSH_PORT || '22';
const deployPath = process.env.DEPLOY_PATH || '/var/www/chapterone-updates';

if (!version || !user || !host) {
  console.error('Missing required environment variables (RELEASE_VERSION, SSH_USER, SSH_HOST)');
  process.exit(1);
}

try {
  console.log(`Publishing latest pointer for version ${version} on remote server...`);
  
  // Safely copy manifest to latest inside release directory
  const sshCmd = `ssh -p ${port} -o StrictHostKeyChecking=no ${user}@${host} "mkdir -p ${deployPath}/latest && cp ${deployPath}/releases/${version}/manifest.json ${deployPath}/latest/manifest.json"`;
  
  execSync(sshCmd, { stdio: 'inherit' });
  console.log('Latest pointer updated successfully.');
} catch (err) {
  console.error('Failed to update latest pointer:', err.message);
  process.exit(1);
}
