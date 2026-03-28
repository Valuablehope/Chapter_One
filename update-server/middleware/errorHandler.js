const { logger } = require('./logger');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled Server Error', { error: err.message, stack: err.stack, url: req.url });
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: {
      message: message,
      status: statusCode
    }
  });
}

module.exports = errorHandler;
