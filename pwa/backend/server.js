const express = require('express');
const cors = require('cors');
const logger = require('../config/logger');
const healthRoute = require('./routes/health');

let server = null;
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/health', healthRoute);

// Placeholder for other backend API routes
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is functional' });
});

// Front-end placeholder
app.get('/', (req, res) => {
  res.send('<h2>Chapter One POS Backend Running</h2>');
});

function start() {
  return new Promise((resolve, reject) => {
    try {
      server = app.listen(port, () => {
        logger.info(`Backend listening on port ${port}`);
        resolve();
      });
      server.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function stop() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        logger.info('Backend server closed');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  start,
  stop,
  app
};
