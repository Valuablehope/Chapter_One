const { execSync } = require('child_process');

const version = process.env.RELEASE_VERSION;
const user = process.env.SSH_USER;
const host = process.env.SSH_HOST;
const port = process.env.SSH_PORT || '22';
const deployPath = process.env.DEPLOY_PATH || '/var/www/chapterone-updates';

if (!version || !user || !host) {
  console.error('Missing deploy ENV vars required for ssh commands');
  process.exit(1);
}

try {
  console.log(`Setting up remote directory structure for version ${version}...`);
  // Ensure target dir exists
  const targetDir = `${deployPath}/releases/${version}`;
  execSync(`ssh -p ${port} -o StrictHostKeyChecking=no ${user}@${host} "mkdir -p ${targetDir}"`, { stdio: 'inherit' });

  console.log('Uploading artifacts securely via SCP...');
  // Use dist folder assuming built output and manifests live there
  // e.g. dist/ChapterOnePOS-Setup-1.2.5.exe, dist/latest.yml, dist/manifest.json
  const scpCmd = `scp -P ${port} -o StrictHostKeyChecking=no dist/* ${user}@${host}:${targetDir}/`;
  execSync(scpCmd, { stdio: 'inherit' });

  console.log(`Successfully deployed files to ${targetDir}`);
} catch (error) {
  console.error('Deployment failed:', error.message);
  process.exit(1);
}
