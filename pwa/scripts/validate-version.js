const path = require('path');
const semver = require('semver');

const pkgPath = path.join(__dirname, '../package.json');
try {
  const pkg = require(pkgPath);
  const v = pkg.version;
  
  if (!semver.valid(v)) {
    console.error(`Version ${v} in package.json is NOT a valid semver version.`);
    process.exit(1);
  }
  
  console.log(`Version ${v} is valid semver.`);
  process.exit(0);
} catch (error) {
  console.error('Error validating version');
  process.exit(1);
}
