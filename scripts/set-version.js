const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error('Usage: node set-version.js <version>');
  process.exit(1);
}

const newVersion = process.argv[2];
const pkgPath = path.join(__dirname, '../package.json');

try {
  const pkgStr = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgStr);
  
  pkg.version = newVersion;
  
  // Format to maintain proper spacing/indentation
  // In a real env, you might want to read existing config, but standard spacing is fine
  const updatedPkgStr = JSON.stringify(pkg, null, 2) + '\n';
  fs.writeFileSync(pkgPath, updatedPkgStr);
  console.log(`Successfully updated package.json to ${newVersion}`);
} catch (error) {
  console.error(`Error writing version: ${error.message}`);
  process.exit(1);
}
