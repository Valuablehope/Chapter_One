/**
 * USB serial customer pole display (POS). See env.example: CUSTOMER_DISPLAY_*.
 *
 * - escpos_dual: ESC @ init, line 1 = store name, line 2 = 8-char amount (typical 2-line VFD).
 * - numeric_only: 8-char amount only (7-segment 8N); storeName is ignored on wire but logged for future UI.
 *
 * Very long receipts: break-inside behavior is a browser concern; serial is independent.
 */
import log from 'electron-log';
import { SerialPort } from 'serialport';

let port: SerialPort | null = null;
let openPath: string | null = null;

function envEnabled(): boolean {
  const e = process.env.CUSTOMER_DISPLAY_ENABLED;
  if (e === '0' || e === 'false' || e === 'FALSE') return false;
  const p = process.env.CUSTOMER_DISPLAY_PORT?.trim();
  return !!p;
}

function getBaud(): number {
  const b = parseInt(process.env.CUSTOMER_DISPLAY_BAUD || '9600', 10);
  return Number.isFinite(b) && b > 0 ? b : 9600;
}

function getMode(): 'escpos_dual' | 'numeric_only' {
  const m = (process.env.CUSTOMER_DISPLAY_MODE || 'escpos_dual').toLowerCase();
  return m === 'numeric_only' ? 'numeric_only' : 'escpos_dual';
}

function nameMaxChars(): number {
  const n = parseInt(process.env.CUSTOMER_DISPLAY_NAME_MAX_CHARS || '20', 10);
  return Math.min(80, Math.max(4, Number.isFinite(n) ? n : 20));
}

export function truncateStoreNameForDisplay(name: string): string {
  const max = nameMaxChars();
  const cleaned = name.replace(/[^\x20-\x7E]/g, '').trim();
  if (cleaned.length <= max) return cleaned || 'Store';
  return cleaned.slice(0, Math.max(0, max - 1)) + '.';
}

/** Fixed 8 character width for typical 8-digit price line. */
export function formatDisplayAmount(value: number): string {
  if (!Number.isFinite(value)) return '   0.00';
  const neg = value < 0;
  const s = Math.abs(value).toFixed(2);
  const out = neg ? `-${s}` : s;
  if (out.length > 8) return out.slice(0, 8);
  return out.padStart(8, ' ');
}

function buildPayload(storeName: string, amount: number): Buffer {
  const mode = getMode();
  const amt = formatDisplayAmount(amount);
  if (mode === 'numeric_only') {
    return Buffer.from(`\x0C${amt}\r\n`, 'ascii');
  }
  const name = truncateStoreNameForDisplay(storeName);
  const init = Buffer.from([0x1b, 0x40]); // ESC @
  const line1 = Buffer.from(`${name}\r\n`, 'ascii');
  const line2 = Buffer.from(`${amt}\r\n`, 'ascii');
  return Buffer.concat([init, line1, line2]);
}

function openSerial(): Promise<SerialPort | null> {
  if (!envEnabled()) return Promise.resolve(null);
  const path = process.env.CUSTOMER_DISPLAY_PORT!.trim();

  if (port && openPath === path && port.isOpen) {
    return Promise.resolve(port);
  }

  if (port) {
    try {
      port.removeAllListeners();
      if (port.isOpen) port.close();
    } catch {
      /* ignore */
    }
    port = null;
    openPath = null;
  }

  return new Promise((resolve) => {
    const p = new SerialPort({
      path,
      baudRate: getBaud(),
      autoOpen: false,
    });
    p.open((err) => {
      if (err) {
        log.error('[customerDisplay] Failed to open serial port', path, err);
        resolve(null);
        return;
      }
      port = p;
      openPath = path;
      log.info(`[customerDisplay] Opened ${path} @ ${getBaud()} baud (mode=${getMode()})`);
      p.on('error', (e) => {
        log.error('[customerDisplay] Serial error', e);
      });
      resolve(p);
    });
  });
}

export async function showCustomerDisplay(storeName: string, amount: number): Promise<void> {
  if (!envEnabled()) return;
  if (!Number.isFinite(amount)) return;

  const p = await openSerial();
  if (!p || !p.isOpen) return;

  const payload = buildPayload(storeName, amount);
  await new Promise<void>((resolve) => {
    p.write(payload, (err) => {
      if (err) log.error('[customerDisplay] Write failed', err);
      resolve();
    });
  });
}

export function closeCustomerDisplayPort(): void {
  if (port?.isOpen) {
    try {
      port.close();
    } catch {
      /* ignore */
    }
  }
  port = null;
  openPath = null;
}
