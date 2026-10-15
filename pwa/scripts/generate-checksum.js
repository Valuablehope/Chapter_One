const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const targetFile = process.argv[2];
const outputFile = process.argv[3];

if (!targetFile || !outputFile) {
  console.error('Usage: node generate-checksum.js <file_to_hash> <output_file>');
  process.exit(1);
}

try {
  const fileBuffer = fs.readFileSync(targetFile);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const hex = hashSum.digest('hex');

  fs.writeFileSync(outputFile, hex);
  console.log(`Checksum generated for ${targetFile}: ${hex}`);
  
  // Also print to stdout to capture in CI
  console.log(`::set-output name=checksum::${hex}`);
} catch (error) {
  console.error(`Failed to generate checksum: ${error.message}`);
  process.exit(1);
}
