const { execSync } = require('child_process');

const version = process.env.RELEASE_VERSION;
const user = process.env.SSH_USER;
const host = process.env.SSH_HOST;
const port = process.env.SSH_PORT || '22';
const deployPath = process.env.DEPLOY_PATH || '/var/www/chapterone-updates';

if (!version || !user || !host) {
  console.error('Missing environment variables required for verfication');
  process.exit(1);
}

try {
  console.log(`Verifying deployment for ${version}...`);
  const targetDir = `${deployPath}/releases/${version}`;

  // Check if manifest.json exists and size > 0
  const verifyCmd = `ssh -p ${port} -o StrictHostKeyChecking=no ${user}@${host} "test -s ${targetDir}/manifest.json && echo 'Manifest Validated' || exit 1"`;
  
  execSync(verifyCmd, { stdio: 'pipe' });
  console.log('Remote verification passed.');
} catch (err) {
  console.error('Verification step failed. Uploaded artifacts might be missing or corrupt.', err.message);
  process.exit(1);
}
