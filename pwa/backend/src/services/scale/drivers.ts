import * as net from 'net';
import { ScaleDevice, ScalePluProduct } from '../../models/ScaleModel';

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  sent: number;
  /** For file-based drivers: the generated file content (served as a download) */
  payload?: string;
  filename?: string;
}

/**
 * Common interface every scale driver implements. New brand-specific drivers
 * (native binary protocols) can be added here without touching the rest of
 * the module.
 */
export interface ScaleDriver {
  readonly key: string;
  testConnection(device: ScaleDevice): Promise<ConnectionTestResult>;
  syncPlus(device: ScaleDevice, products: ScalePluProduct[]): Promise<SyncResult>;
}

// ---------------------------------------------------------------------------
// Template rendering
//
// Record templates use {field} placeholders, with optional formatting:
//   {plu}          -> 42
//   {plu:5}        -> 00042           (zero-padded number / space-padded text)
//   {name:20}      -> name truncated/padded to 20 chars
//   {price}        -> 12.5
//   {price_cents}  -> 1250            (price * 100, integer)
//   {price_cents:6}-> 001250
//   {unit}         -> kg
//   {tax_rate}     -> 11
//   {department}   -> 1
//   {barcode_plu}  -> zero-padded PLU (5 digits), the classic label PLU field
// ---------------------------------------------------------------------------

function renderTemplate(
  template: string,
  product: ScalePluProduct,
  device: ScaleDevice
): string {
  const price = Number(product.sale_price || product.list_price || 0);
  const fields: Record<string, string | number> = {
    plu: product.plu_code,
    name: product.name,
    price: price,
    price_cents: Math.round(price * 100),
    unit: product.unit_of_measure || 'kg',
    tax_rate: Number(product.tax_rate || 0),
    department: device.department ?? 1,
    barcode_plu: String(product.plu_code).padStart(5, '0'),
  };

  return template.replace(/\{(\w+)(?::(\d+))?\}/g, (match, key: string, width?: string) => {
    const raw = fields[key];
    if (raw === undefined) return match;
    if (width) {
      const w = parseInt(width, 10);
      if (typeof raw === 'number') return String(raw).padStart(w, '0');
      return String(raw).slice(0, w).padEnd(w, ' ');
    }
    return String(raw);
  });
}

const DEFAULT_TCP_TEMPLATE = '{plu},{name},{price}';
const DEFAULT_CSV_TEMPLATE = '{plu},{name},{price},{unit},{department}';
const DEFAULT_CSV_HEADER = 'PLU,Name,Price,Unit,Department';

// ---------------------------------------------------------------------------
// Generic TCP driver — pushes one text record per PLU over a raw socket.
// Works with any scale (or scale gateway/vendor daemon) that accepts
// line-based ASCII PLU uploads. Record layout is fully configurable.
// ---------------------------------------------------------------------------

class GenericTcpDriver implements ScaleDriver {
  readonly key = 'generic_tcp';

  private connect(device: ScaleDevice): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      if (!device.host || !device.port) {
        reject(new Error('Scale host and port are required for TCP sync'));
        return;
      }
      const timeoutMs = Number(device.options?.connect_timeout_ms || 5000);
      const socket = net.createConnection({ host: device.host, port: device.port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Connection to ${device.host}:${device.port} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      socket.once('connect', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async testConnection(device: ScaleDevice): Promise<ConnectionTestResult> {
    try {
      const socket = await this.connect(device);
      socket.end();
      return { success: true, message: `Connected to ${device.host}:${device.port}` };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Connection failed' };
    }
  }

  async syncPlus(device: ScaleDevice, products: ScalePluProduct[]): Promise<SyncResult> {
    const template = device.options?.record_template || DEFAULT_TCP_TEMPLATE;
    const lineEnding = device.options?.line_ending === 'lf' ? '\n' : '\r\n';
    const encoding = (device.options?.encoding || 'ascii') as BufferEncoding;

    const records = products.map((p) => renderTemplate(template, p, device)).join(lineEnding);
    const data = records.length > 0 ? records + lineEnding : '';

    const socket = await this.connect(device);
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('error', reject);
        socket.write(data, encoding, (err) => (err ? reject(err) : resolve()));
      });
      // Give the scale a moment to consume the stream before closing.
      await new Promise<void>((resolve) => socket.end(() => resolve()));
      return {
        success: true,
        message: `Sent ${products.length} PLU record(s) to ${device.host}:${device.port}`,
        sent: products.length,
      };
    } catch (err: any) {
      socket.destroy();
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// CSV export driver — generates a PLU file the brand's own PC tool
// (CAS CL-Works, DIGI SM-Works/DLP, Aclas AclasPLU, Rongta tools, ...)
// imports and downloads to the scale. This is the guaranteed path for
// scales whose native network protocol is proprietary.
// ---------------------------------------------------------------------------

class CsvExportDriver implements ScaleDriver {
  readonly key = 'csv_export';

  async testConnection(_device: ScaleDevice): Promise<ConnectionTestResult> {
    return {
      success: true,
      message: 'CSV export requires no connection — use Sync to generate the PLU file.',
    };
  }

  async syncPlus(device: ScaleDevice, products: ScalePluProduct[]): Promise<SyncResult> {
    const template = device.options?.record_template || DEFAULT_CSV_TEMPLATE;
    const header = device.options?.csv_header ?? DEFAULT_CSV_HEADER;
    const lines = products.map((p) => renderTemplate(template, p, device));
    const payload = (header ? header + '\r\n' : '') + lines.join('\r\n') + '\r\n';
    const safeName = device.name.replace(/[^\w-]+/g, '_').toLowerCase();

    return {
      success: true,
      message: `Generated PLU file with ${products.length} record(s). Import it with the scale vendor's PC tool.`,
      sent: products.length,
      payload,
      filename: `plu_${safeName}.csv`,
    };
  }
}

// ---------------------------------------------------------------------------
// Registry & brand presets
// ---------------------------------------------------------------------------

const drivers: Record<string, ScaleDriver> = {
  generic_tcp: new GenericTcpDriver(),
  csv_export: new CsvExportDriver(),
};

export function getDriver(key: string): ScaleDriver {
  const driver = drivers[key];
  if (!driver) {
    throw new Error(`Unknown scale driver: ${key}`);
  }
  return driver;
}

export interface ScaleBrandPreset {
  key: string;
  label: string;
  driver: 'generic_tcp' | 'csv_export';
  default_port?: number;
  default_options?: Record<string, any>;
  notes: string;
}

/**
 * Starting points for common brands. Ports/templates are suggestions taken
 * from each vendor's common configuration and remain fully editable —
 * "universal" support comes from the configurable TCP/CSV drivers plus the
 * barcode format decoder, not from hardcoded per-brand protocols.
 */
export const SCALE_BRAND_PRESETS: ScaleBrandPreset[] = [
  {
    key: 'generic',
    label: 'Generic / Other (TCP text records)',
    driver: 'generic_tcp',
    default_options: { record_template: DEFAULT_TCP_TEMPLATE, line_ending: 'crlf' },
    notes:
      'Pushes one configurable text record per PLU over TCP. Works with any scale or gateway accepting ASCII PLU uploads.',
  },
  {
    key: 'cas',
    label: 'CAS (CL3000 / CL5000 / CL5500)',
    driver: 'generic_tcp',
    default_port: 20304,
    default_options: { record_template: DEFAULT_TCP_TEMPLATE, line_ending: 'crlf' },
    notes:
      'CAS CL-series listens on port 20304. If your firmware only accepts CL-Works transfers, switch the driver to CSV export and import the file with CL-Works.',
  },
  {
    key: 'digi',
    label: 'DIGI (SM-100 / SM-300 / SM-5300)',
    driver: 'csv_export',
    default_port: 26,
    default_options: {},
    notes:
      "DIGI's native protocol is proprietary (TCP port 26). Recommended: CSV export imported via SM-Works / DLP, or generic TCP if a text-import gateway is configured.",
  },
  {
    key: 'aclas',
    label: 'Aclas (LS2 / OS2 series)',
    driver: 'generic_tcp',
    default_port: 4001,
    default_options: { record_template: DEFAULT_TCP_TEMPLATE, line_ending: 'crlf' },
    notes:
      'Many Aclas label scales accept network PLU updates; otherwise use CSV export with the AclasPLU tool.',
  },
  {
    key: 'rongta',
    label: 'Rongta (RLS1000 / RLS1100)',
    driver: 'csv_export',
    default_options: {},
    notes: 'Use CSV export with the Rongta PLU tool, or generic TCP if your model exposes a text port.',
  },
  {
    key: 'mettler_toledo',
    label: 'Mettler Toledo (bPlus / bTwin / Tiger)',
    driver: 'csv_export',
    default_options: {},
    notes: 'Use CSV export with SmartManager / vendor tools, or generic TCP for models with an open text port.',
  },
  {
    key: 'bizerba',
    label: 'Bizerba (SC / XC series)',
    driver: 'csv_export',
    default_options: {},
    notes: 'Use CSV export with Bizerba RetailConnect / vendor tools.',
  },
];
