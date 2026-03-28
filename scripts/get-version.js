const path = require('path');
const pkgPath = path.join(__dirname, '../package.json');
try {
  const pkg = require(pkgPath);
  console.log(pkg.version);
} catch (error) {
  console.error('Error reading package.json version');
  process.exit(1);
}
