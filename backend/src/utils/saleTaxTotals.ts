/**
 * Sale line and header totals for tax-inclusive vs tax-off store settings.
 * Keep in sync with frontend sale total helpers where applicable.
 */

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type SaleTaxMode = 'inclusive' | 'exclusive';

export interface LineInput {
  qty: number;
  unit_price: number;
  tax_rate: number;
}

export interface ComputedLine {
  unit_price: number;
  tax_rate: number;
  line_total: number;
  line_net: number;
  line_tax: number;
}

export function computeLineAmounts(item: LineInput, mode: SaleTaxMode): ComputedLine {
  const qty = item.qty;
  const unit = item.unit_price;

  if (mode === 'exclusive') {
    const lineGross = roundMoney(qty * unit);
    return {
      unit_price: unit,
      tax_rate: 0,
      line_total: lineGross,
      line_net: lineGross,
      line_tax: 0,
    };
  }

  const r = Math.min(100, Math.max(0, Number(item.tax_rate) || 0));
  const lineGross = roundMoney(qty * unit);
  if (r <= 0) {
    return {
      unit_price: unit,
      tax_rate: r,
      line_total: lineGross,
      line_net: lineGross,
      line_tax: 0,
    };
  }
  const lineNet = roundMoney(lineGross / (1 + r / 100));
  const lineTax = roundMoney(lineGross - lineNet);
  return {
    unit_price: unit,
    tax_rate: r,
    line_total: lineGross,
    line_net: lineNet,
    line_tax: lineTax,
  };
}

export function aggregateLines(lines: ComputedLine[]): {
  subtotal: number;
  taxTotal: number;
  merchandiseGross: number;
} {
  let subtotal = 0;
  let taxTotal = 0;
  let merchandiseGross = 0;
  for (const l of lines) {
    subtotal += l.line_net;
    taxTotal += l.line_tax;
    merchandiseGross += l.line_total;
  }
  return {
    subtotal: roundMoney(subtotal),
    taxTotal: roundMoney(taxTotal),
    merchandiseGross: roundMoney(merchandiseGross),
  };
}

export function saleDiscountAndGrand(
  merchandiseGross: number,
  discountRate: number
): { discountTotal: number; grandTotal: number } {
  const dr = discountRate || 0;
  if (dr <= 0) {
    return { discountTotal: 0, grandTotal: roundMoney(merchandiseGross) };
  }
  const discountTotal = roundMoney(merchandiseGross * (dr / 100));
  return { discountTotal, grandTotal: roundMoney(merchandiseGross - discountTotal) };
}

/** Recompute header totals from persisted sale_items rows (edit sale). */
export function totalsFromPersistedItems(
  rows: { qty: number; unit_price: number; tax_rate: number }[],
  taxInclusive: boolean
): { subtotal: number; taxTotal: number; merchandiseGross: number } {
  const mode: SaleTaxMode = taxInclusive ? 'inclusive' : 'exclusive';
  const lines = rows.map((row) =>
    computeLineAmounts(
      {
        qty: Number(row.qty),
        unit_price: Number(row.unit_price),
        tax_rate: Number(row.tax_rate) || 0,
      },
      mode
    )
  );
  return aggregateLines(lines);
}
