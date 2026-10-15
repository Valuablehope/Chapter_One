import os from 'os';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: APP_VERSION } = require('../../package.json');

const HEARTBEAT_INTERVAL_MS = 20_000;

function getLocalIpAddress(): string | null {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }
  return null;
}

async function sendHeartbeat(terminalId: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE terminals
       SET last_seen_at = now(), hostname = $1, ip_address = $2, app_version = $3
       WHERE terminal_id = $4`,
      [os.hostname(), getLocalIpAddress(), APP_VERSION, terminalId]
    );
  } catch (err) {
    logger.warn('Terminal heartbeat failed:', err);
  }
}

/**
 * If this machine has been paired to a terminal (TERMINAL_ID set in the local
 * .env by the Setup Wizard / Admin Tools pairing flow), periodically report
 * liveness so the admin panel can show real connection status. No-ops for
 * unpaired/legacy single-PC installs.
 */
export function startTerminalHeartbeat(): void {
  const terminalId = process.env.TERMINAL_ID;
  if (!terminalId) return;

  void sendHeartbeat(terminalId);
  setInterval(() => void sendHeartbeat(terminalId), HEARTBEAT_INTERVAL_MS);
  logger.info(`Terminal heartbeat started for terminal_id=${terminalId}`);
}
