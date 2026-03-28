const { Pool } = require('pg');
const logger = require('../config/logger');

let pool = null;
let connected = false;

function getDbConfig() {
  return {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'chapterone_pos',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
  };
}

async function connect() {
  if (!pool) {
    pool = new Pool(getDbConfig());
    
    // Test connection
    const client = await pool.connect();
    client.release();
    connected = true;
  }
  return pool;
}

async function disconnect() {
  if (pool) {
    await pool.end();
    pool = null;
    connected = false;
  }
}

async function query(text, params) {
  if (!pool) await connect();
  return pool.query(text, params);
}

async function getClient() {
  if (!pool) await connect();
  return pool.connect();
}

function isConnected() {
  return connected;
}

module.exports = {
  connect,
  disconnect,
  query,
  getClient,
  isConnected
};
