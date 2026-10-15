import { ScaleBarcodeFormat } from '../../models/ScaleModel';

export interface ParsedScaleBarcode {
  format_id: string;
  format_name: string;
  prefix: string;
  plu_code: number;
  /** Decoded value after applying the divisor (e.g. 12.50 for a price, 0.485 for kg) */
  value: number | null;
  value_type: 'price' | 'weight' | 'quantity' | 'none';
  /** true / false when an EAN-13 check digit was verified, null when the format has none */
  checksum_valid: boolean | null;
}

/**
 * GS1 mod-10 check digit (EAN-8 / EAN-13 / UPC-A / any GS1 length).
 * Weights 3,1,3,1,... applied from the rightmost data digit.
 */
export function gs1CheckDigit(dataDigits: string): number {
  let sum = 0;
  for (let i = 0; i < dataDigits.length; i++) {
    const digit = dataDigits.charCodeAt(dataDigits.length - 1 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Try to decode a scanned barcode against one configured scale-label format.
 * Returns null when the barcode does not match the format (wrong length,
 * wrong prefix, non-numeric, or failing check digit).
 */
export function tryParseWithFormat(
  barcode: string,
  format: ScaleBarcodeFormat
): ParsedScaleBarcode | null {
  if (!/^\d+$/.test(barcode)) return null;

  const checkLen = format.check_digit === 'ean13' ? 1 : 0;
  const prefixes = format.prefixes
    .split(',')
    .map((p) => p.trim())
    .filter((p) => /^\d+$/.test(p));

  for (const prefix of prefixes) {
    const expectedLength = prefix.length + format.plu_length + format.value_length + checkLen;
    if (barcode.length !== expectedLength) continue;
    if (!barcode.startsWith(prefix)) continue;

    if (checkLen === 1) {
      const data = barcode.slice(0, -1);
      const check = barcode.charCodeAt(barcode.length - 1) - 48;
      if (gs1CheckDigit(data) !== check) continue;
    }

    const pluStr = barcode.substr(prefix.length, format.plu_length);
    const pluCode = parseInt(pluStr, 10);
    if (Number.isNaN(pluCode)) continue;

    let value: number | null = null;
    if (format.value_length > 0 && format.value_type !== 'none') {
      const valueStr = barcode.substr(prefix.length + format.plu_length, format.value_length);
      const rawValue = parseInt(valueStr, 10);
      if (Number.isNaN(rawValue)) continue;
      value = rawValue / Number(format.value_divisor);
    }

    return {
      format_id: format.format_id,
      format_name: format.name,
      prefix,
      plu_code: pluCode,
      value,
      value_type: format.value_type,
      checksum_valid: checkLen === 1 ? true : null,
    };
  }

  return null;
}

/**
 * Decode a scanned barcode against all active formats (ordered by priority).
 * The first matching format wins.
 */
export function parseScaleBarcode(
  barcode: string,
  formats: ScaleBarcodeFormat[]
): ParsedScaleBarcode | null {
  const trimmed = barcode.trim();
  for (const format of formats) {
    if (!format.is_active) continue;
    const parsed = tryParseWithFormat(trimmed, format);
    if (parsed) return parsed;
  }
  return null;
}

export interface ScaleLineInfo {
  plu_code: number;
  format_name: string;
  value_type: 'price' | 'weight' | 'quantity' | 'none';
  /** Quantity to add to the cart (kg for weight labels, computed for price labels) */
  qty: number;
  /** Line total forced by the label, when the label embeds a price */
  line_total: number | null;
  /** The product's unit price used for the computation */
  unit_price: number;
}

/**
 * Turn a decoded label + the matched product's unit price into a sale line.
 *
 * - price-embedded labels: the label total is authoritative; qty is derived
 *   (qty = label price / unit price) so stock is still decremented by weight.
 * - weight-embedded labels: qty = weight; total = qty * unit price.
 * - quantity labels: qty as embedded.
 * - none: qty = 1 (label only identifies the PLU).
 */
export function computeScaleLine(
  parsed: ParsedScaleBarcode,
  unitPrice: number
): ScaleLineInfo {
  let qty = 1;
  let lineTotal: number | null = null;

  switch (parsed.value_type) {
    case 'price': {
      lineTotal = parsed.value ?? 0;
      qty = unitPrice > 0 ? Math.round((lineTotal / unitPrice) * 1000) / 1000 : 1;
      if (qty <= 0) qty = 1;
      break;
    }
    case 'weight': {
      qty = parsed.value ?? 1;
      if (qty <= 0) qty = 1;
      break;
    }
    case 'quantity': {
      qty = parsed.value ?? 1;
      if (qty <= 0) qty = 1;
      break;
    }
    case 'none':
    default:
      qty = 1;
  }

  return {
    plu_code: parsed.plu_code,
    format_name: parsed.format_name,
    value_type: parsed.value_type,
    qty,
    line_total: lineTotal,
    unit_price: unitPrice,
  };
}
