const winston = require('winston');
const morgan = require('morgan');
const path = require('path');
const config = require('../config');

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${stack ? '\n' + stack : ''}`;
  })
);

const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/error.log'), 
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/access.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

// Stream for morgan
const stream = {
  write: (message) => logger.info(message.trim())
};

const requestLogger = morgan(
  ':remote-addr - :method :url :status :res[content-length] - :response-time ms',
  { stream }
);

module.exports = { logger, requestLogger };
