/**
 * Validates the structure of a fetched manifest JSON
 * @param {Object} manifest 
 * @returns {boolean}
 */
function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return false;
  }

  // Required keys
  const requiredKeys = ['version', 'files', 'checksum'];
  for (const key of requiredKeys) {
    if (!manifest[key]) return false;
  }

  if (typeof manifest.files !== 'object') {
    return false;
  }

  return true;
}

module.exports = {
  validateManifest
};
