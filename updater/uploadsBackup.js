const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(listFilesRecursive(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function copyRecursive(sourceDir, destDir) {
  let copied = 0;
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copied += copyRecursive(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
      copied++;
    }
  }
  return copied;
}

/**
 * Stashes uploaded files (product images, receipt QR, receipt logo) to the
 * client's Desktop before an update installs — belt-and-suspenders alongside
 * the pg_dump backup. Uploads normally live outside the install directory
 * (see backend/src/utils/uploadsPath.ts) and are never touched by an update
 * once there, but this covers the one transition update itself, and any
 * future regression back into the install directory.
 *
 * @param {string[]} candidateDirs  Upload directories to check, in preference order
 *   (e.g. the persistent userData location, then the legacy in-install-dir one).
 * @param {string} desktopPath
 * @param {string} timestamp  Shared with the DB backup filename so the two are easy to pair up.
 */
function backupUploads(candidateDirs, desktopPath, timestamp) {
  const sourceDir = candidateDirs.find((d) => listFilesRecursive(d).length > 0);

  if (!sourceDir) {
    logger.info('No uploaded files found in any known location — nothing to stash before update.');
    return { success: true, skipped: true };
  }

  const destDir = path.join(desktopPath, `chapter_one_uploads_backup_${timestamp}`);

  try {
    fs.mkdirSync(destDir, { recursive: true });
    const copied = copyRecursive(sourceDir, destDir);
    logger.info(`Stashed ${copied} upload file(s) from ${sourceDir} to ${destDir} before update.`);
    return { success: true, backupPath: destDir, fileCount: copied };
  } catch (err) {
    logger.error(`Failed to stash uploads before update: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = { backupUploads };
