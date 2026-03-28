const winston = require('winston');
const path = require('path');
const { app } = require('electron');

let userDataPath = '';
try {
  // If running inside electron
  userDataPath = app.getPath('userData');
} catch (error) {
  // Fallback if imported in pure Node.js context
  userDataPath = path.join(process.cwd(), 'logs');
}

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    if (Object.keys(meta).length > 0) {
      logMessage += ` | meta: ${JSON.stringify(meta)}`;
    }
    if (stack) {
      logMessage += `\n${stack}`;
    }
    return logMessage;
  })
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: path.join(userDataPath, 'error.log'), 
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(userDataPath, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ]
});

module.exports = logger;
