const path = require('path');
require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 8080,
  releasesDir: process.env.RELEASES_DIR || path.join(__dirname, 'releases'),
  secretKey: process.env.SECRET_KEY || 'default_secret_key'
};
