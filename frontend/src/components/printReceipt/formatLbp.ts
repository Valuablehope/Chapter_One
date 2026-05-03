/** LBP amount for a USD grand total, or null when rate is missing or invalid. */
export function formatLbpGrand(
  grandUsd: number,
  rate: number | null | undefined,
  roundUp1000?: boolean
): number | null {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return null;
  const rawLbp = grandUsd * r;
  return roundUp1000 ? Math.ceil(rawLbp / 1000) * 1000 : Math.round(rawLbp);
}

export function formatLbpPlain(lbp: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(lbp);
}
