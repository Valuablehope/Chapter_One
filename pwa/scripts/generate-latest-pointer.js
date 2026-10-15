const fs = require('fs');
const path = require('path');

const version = process.argv[2];
const checksumFile = process.argv[3];
const manifestFile = process.argv[4];

if (!version || !manifestFile) {
  console.error("Usage: node generate-latest-pointer.js <version> [checksumFile] <manifestFile>");
  process.exit(1);
}

try {
  const distDir = path.join(__dirname, '../dist');
  const pointerPath = path.join(distDir, 'latest-pointer.json');

  const pointerObj = {
    version: version,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(pointerPath, JSON.stringify(pointerObj, null, 2));
  console.log('Created local latest-pointer.json');
} catch (err) {
  console.error('Error generating latest pointer locally', err.message);
  process.exit(1);
}
