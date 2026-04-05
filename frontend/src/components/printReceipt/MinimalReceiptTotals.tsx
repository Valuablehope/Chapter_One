export type TotalEmphasis = 'normal' | 'strong' | 'strongSub';

/** strong: first emphasized total (top rule). strongSub: bold net line without extra rule (e.g. LBP after USD). */
export interface TotalRow {
  label: string;
  value: string;
  emphasis?: TotalEmphasis;
}

export function MinimalReceiptTotals({ rows }: { rows: TotalRow[] }) {
  return (
    <div className="space-y-0.5 text-xs border-t border-black pt-1 mt-1">
      {rows.map((r, i) => (
        <div
          key={i}
          className={`flex justify-between gap-2 text-black ${
            r.emphasis === 'strong'
              ? 'font-bold pt-1 border-t border-black mt-1 text-sm'
              : r.emphasis === 'strongSub'
                ? 'font-bold text-sm'
                : ''
          }`}
        >
          <span>{r.label}</span>
          <span className="text-right whitespace-nowrap font-mono">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
