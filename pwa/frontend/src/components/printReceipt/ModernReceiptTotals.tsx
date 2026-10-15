import type { TotalRow } from './MinimalReceiptTotals';

export function ModernReceiptTotals({ rows, itemCount }: { rows: TotalRow[]; itemCount?: number }) {
  return (
    <div className="text-[13px] space-y-1">
      {itemCount != null && (
        <div className="flex justify-between gap-3 leading-relaxed text-gray-500">
          <span>Items count</span>
          <span className="font-semibold text-gray-900">{itemCount}</span>
        </div>
      )}
      {rows.map((r, i) => (
        <div
          key={i}
          className={`flex justify-between gap-3 ${
            r.emphasis === 'strong'
              ? 'font-bold text-[16px] border-t border-gray-900 mt-2 pt-2 text-gray-900'
              : r.emphasis === 'strongSub'
                ? 'font-semibold text-[13px] leading-relaxed text-gray-700'
                : 'leading-relaxed text-gray-500'
          }`}
        >
          <span className={r.emphasis === 'strong' ? '' : undefined}>{r.label}</span>
          <span className={`text-right ${r.emphasis === 'strong' ? '' : 'font-semibold text-gray-900'}`}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
