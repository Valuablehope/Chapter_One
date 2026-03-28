const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const { logger, requestLogger } = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const updateRoutes = require('./routes/update');
const security = require('./security');

const app = express();

// Security Headers
app.use(helmet());
app.use(cors());

// Body Parser
app.use(express.json());

// Logging
app.use(requestLogger);

// Health Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: config.env,
    timestamp: new Date().toISOString()
  });
});

// Update Endpoints
app.use('/update', updateRoutes);

// Static file serving for releases (secured pathing)
app.use('/releases', security.staticAuthPlaceholder, express.static(config.releasesDir, {
  setHeaders: (res, path, stat) => {
    // Add appropriate MIME types based on file extensions if needed
    if (path.endsWith('.exe')) {
      res.set('Content-Type', 'application/x-msdownload');
    }
  }
}));

// Error Handling
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`Update server listening on port ${config.port}`);
  logger.info(`Releases directory: ${config.releasesDir}`);
});
