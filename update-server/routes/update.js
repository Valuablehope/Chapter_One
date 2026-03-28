const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const { logger } = require('../middleware/logger');

// Central pointer for the latest release manifest
router.get('/latest', async (req, res, next) => {
  try {
    const latestPointerPath = path.join(config.releasesDir, '../latest/manifest.json');
    
    // Check if the file exists
    try {
      await fs.access(latestPointerPath);
    } catch (err) {
      return res.status(404).json({ error: 'No latest release manifest found.' });
    }

    const manifestData = await fs.readFile(latestPointerPath, 'utf8');
    const manifest = JSON.parse(manifestData);

    logger.info(`Successfully served latest manifest. Version: ${manifest.version}`);
    res.json(manifest);
  } catch (error) {
    logger.error('Error serving latest update manifest', { error: error.message });
    next(error);
  }
});

module.exports = router;
