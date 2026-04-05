export interface MetaRow {
  label: string;
  value: string;
}

export function MinimalReceiptMeta({ rows }: { rows: MetaRow[] }) {
  return (
    <div className="mb-2 space-y-0.5 text-xs">
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between gap-2">
          <span className="text-black">{r.label}</span>
          <span className="font-mono font-semibold text-black text-right shrink-0">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
