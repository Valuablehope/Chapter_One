export interface MetaRow {
  label: string;
  value: string;
}

export function MinimalReceiptMeta({ rows }: { rows: MetaRow[] }) {
  return (
    <div className="mb-2 text-[11px] pb-1.5 border-b border-dashed border-black">
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between gap-2 leading-[1.65]">
          <span className="min-w-0 flex-1 font-semibold" style={{ color: 'rgba(0,0,0,0.75)' }}>{r.label}</span>
          <span className="font-mono font-bold text-black text-right shrink-0 whitespace-nowrap">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
