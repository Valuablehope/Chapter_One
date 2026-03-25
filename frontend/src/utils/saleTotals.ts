/**
 * Client-side sale totals aligned with backend/src/utils/saleTaxTotals.ts
 */

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type SaleTaxMode = 'inclusive' | 'exclusive';

export function effectiveProductTaxRate(
  productTax: number | null | undefined,
  storeDefaultPercent: number
): number {
  if (productTax != null && productTax !== undefined && !Number.isNaN(Number(productTax))) {
    return Math.min(100, Math.max(0, Number(productTax)));
  }
  return Math.min(100, Math.max(0, Number(storeDefaultPercent || 0)));
}

export function computeLineAmounts(
  qty: number,
  unitPrice: number,
  taxRate: number,
  mode: SaleTaxMode
): { unit_price: number; tax_rate: number; line_total: number; line_net: number; line_tax: number } {
  const unit = unitPrice;

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

  const r = Math.min(100, Math.max(0, Number(taxRate) || 0));
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

export function discountAndGrand(
  merchandiseGross: number,
  discountRatePercent: number
): { discountAmount: number; grandTotal: number } {
  const dr = discountRatePercent || 0;
  if (dr <= 0) {
    return { discountAmount: 0, grandTotal: roundMoney(merchandiseGross) };
  }
  const discountAmount = roundMoney(merchandiseGross * (dr / 100));
  return { discountAmount, grandTotal: roundMoney(merchandiseGross - discountAmount) };
}
