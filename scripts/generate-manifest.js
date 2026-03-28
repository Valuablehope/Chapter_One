const fs = require('fs');
const path = require('path');

if (process.argv.length < 4) {
  console.error('Usage: node generate-manifest.js <version> <checksum> [base_url]');
  process.exit(1);
}

const version = process.argv[2];
const checksum = process.argv[3];
const baseUrl = process.argv[4] || process.env.UPDATE_BASE_URL || `https://updates.chapterone.com`;

const manifest = {
  version: version,
  mandatory: false,
  releaseDate: new Date().toISOString(),
  notes: "Automatic release generated via CI",
  files: {
    appInstaller: `${baseUrl}/releases/${version}/ChapterOnePOS-Setup-${version}.exe`,
    latestYml: `${baseUrl}/releases/${version}/latest.yml`
  },
  migrations: [], // Could be populated dynamically by reading /migrations
  checksum: checksum
};

const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

fs.writeFileSync(path.join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Generated dist/manifest.json for version ${version} with checksum ${checksum}`);
