const express = require('express');
const router = express.Router();
const db = require('../../updater/db');
const { app } = require('electron');

router.get('/', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    if (db.isConnected()) {
      dbStatus = 'connected';
    }
  } catch (err) {
    // Ignore error
  }

  // Get app version from electron app if we are running in electron
  let version = 'unknown';
  try {
    version = app ? app.getVersion() : require('../../package.json').version;
  } catch (err) {
    version = 'unknown';
  }

  res.json({
    status: 'ok',
    version: version,
    db: dbStatus,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
