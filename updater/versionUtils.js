const semver = require('semver');

/**
 * Validates a version string
 * @param {string} version 
 * @returns {boolean}
 */
function isValidVersion(version) {
  return semver.valid(version) !== null;
}

/**
 * Checks if newVersion is greater than currentVersion
 * @param {string} currentVersion 
 * @param {string} newVersion 
 * @returns {boolean}
 */
function isVersionGreater(currentVersion, newVersion) {
  if (!isValidVersion(currentVersion) || !isValidVersion(newVersion)) {
    throw new Error('Invalid version format provided');
  }
  return semver.gt(newVersion, currentVersion);
}

module.exports = {
  isValidVersion,
  isVersionGreater
};
