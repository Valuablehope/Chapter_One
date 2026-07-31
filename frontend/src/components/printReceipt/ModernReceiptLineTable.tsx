import type { LineRow } from './MinimalReceiptLineTable';

export function ModernReceiptLineTable({ rows }: { rows: LineRow[] }) {
  return (
    <div className="mb-2 pb-2 border-b border-dashed border-gray-400 space-y-2.5">
      {rows.map((r, i) => (
        <div key={i}>
          <div className={`text-[13px] font-semibold leading-snug ${r.isReturn ? 'text-red-600' : 'text-gray-900'}`}>
            {r.description}
            {r.isReturn && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide">(Return)</span>}
          </div>
          <div className={`flex justify-between text-[12px] leading-relaxed ${r.isReturn ? 'text-red-500' : 'text-gray-500'}`}>
            <span>{r.qty} × {r.price}</span>
            <span className={`font-semibold ${r.isReturn ? 'text-red-600' : 'text-gray-900'}`}>{r.total}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
