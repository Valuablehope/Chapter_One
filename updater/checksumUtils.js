const crypto = require('crypto');
const fs = require('fs');
const logger = require('../config/logger');

/**
 * Generates SHA256 checksum for a file
 * @param {string} filePath 
 * @returns {Promise<string>}
 */
function generateChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Validates a file against an expected checksum (reject corrupted)
 * @param {string} filePath 
 * @param {string} expectedChecksum 
 * @returns {Promise<boolean>}
 */
async function validateFileChecksum(filePath, expectedChecksum) {
  try {
    const actualChecksum = await generateChecksum(filePath);
    return actualChecksum === expectedChecksum;
  } catch (error) {
    logger.error('Error validating file checksum', { error: error.message, filePath });
    return false;
  }
}

module.exports = {
  generateChecksum,
  validateFileChecksum
};
