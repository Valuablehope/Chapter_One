import type { MetaRow } from './MinimalReceiptMeta';

export function ModernReceiptMeta({ rows }: { rows: MetaRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-3 pb-3 text-[13px] border-b border-dashed border-gray-400 space-y-1">
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between gap-3 leading-relaxed">
          <span className="min-w-0 flex-1 text-gray-500">{r.label}</span>
          <span className="font-semibold text-gray-900 text-right shrink-0">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
