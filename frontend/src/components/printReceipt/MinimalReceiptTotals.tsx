export type TotalEmphasis = 'normal' | 'strong' | 'strongSub';

/** strong: first emphasized total (top rule). strongSub: bold net line without extra rule (e.g. LBP after USD). */
export interface TotalRow {
  label: string;
  value: string;
  emphasis?: TotalEmphasis;
}

export function MinimalReceiptTotals({ rows }: { rows: TotalRow[] }) {
  return (
    <div className="text-[11px] border-t border-black pt-1 mt-0.5">
      {rows.map((r, i) => (
        <div
          key={i}
          className={`flex justify-between gap-2 ${
            r.emphasis === 'strong'
              ? 'font-black text-[13px] border-t-2 border-black mt-1.5 pt-1.5'
              : r.emphasis === 'strongSub'
                ? 'font-bold text-[12px] leading-[1.5]'
                : 'font-semibold text-black leading-[1.65]'
          }`}
        >
          <span className={r.emphasis === 'strong' ? 'uppercase tracking-[0.04em]' : ''}>
            {r.label}
          </span>
          <span className="text-right whitespace-nowrap font-mono">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
