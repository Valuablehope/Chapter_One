import { useTranslation } from '../../i18n/I18nContext';

export interface LineRow {
  description: string;
  qty: string;
  price: string;
  total: string;
  isReturn?: boolean;
}

export function MinimalReceiptLineTable({ rows }: { rows: LineRow[] }) {
  const { t } = useTranslation();

  return (
    <table className="w-full text-[11px] border-collapse mb-1.5">
      <thead>
        <tr className="border-b border-black">
          <th className="text-left font-bold text-black py-1 pr-1">{t('receipt.description')}</th>
          <th className="text-right font-bold text-black py-1 px-0.5 w-[2.25rem]">{t('receipt.qty')}</th>
          <th className="text-right font-bold text-black py-1 px-0.5">{t('receipt.price')}</th>
          <th className="text-right font-bold text-black py-1 pl-0.5">{t('receipt.total')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={`border-b border-gray-200 last:border-0 ${r.isReturn ? 'bg-red-50' : ''}`}>
            <td className={`align-top py-1 pr-1 font-semibold ${r.isReturn ? 'text-red-600' : 'text-black'}`}>
              {r.description}
              {r.isReturn && <span className="ml-1 text-[9px] font-bold uppercase tracking-wide">(Return)</span>}
            </td>
            <td className={`text-right align-top py-1 font-semibold ${r.isReturn ? 'text-red-600' : 'text-black'}`}>{r.qty}</td>
            <td className={`text-right align-top py-1 whitespace-nowrap font-semibold ${r.isReturn ? 'text-red-600' : 'text-black'}`}>{r.price}</td>
            <td className={`text-right align-top py-1 whitespace-nowrap font-bold ${r.isReturn ? 'text-red-600' : 'text-black'}`}>{r.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
