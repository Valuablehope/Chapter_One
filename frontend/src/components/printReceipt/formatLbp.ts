/** LBP amount for a USD grand total, or null when rate is missing or invalid. */
export function formatLbpGrand(
  grandUsd: number,
  rate: number | null | undefined
): number | null {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return null;
  return Math.round(grandUsd * r);
}

export function formatLbpPlain(lbp: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(lbp);
}
