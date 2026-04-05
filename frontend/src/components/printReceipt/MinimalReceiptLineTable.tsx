import { useTranslation } from '../../i18n/I18nContext';

export interface LineRow {
  description: string;
  qty: string;
  price: string;
  total: string;
}

export function MinimalReceiptLineTable({ rows }: { rows: LineRow[] }) {
  const { t } = useTranslation();

  return (
    <table className="w-full text-[11px] border-collapse mb-2">
      <thead>
        <tr className="border-b border-black">
          <th className="text-left font-semibold text-black py-0.5 pr-1">{t('receipt.description')}</th>
          <th className="text-right font-semibold text-black py-0.5 px-0.5 w-[2.25rem]">{t('receipt.qty')}</th>
          <th className="text-right font-semibold text-black py-0.5 px-0.5">{t('receipt.price')}</th>
          <th className="text-right font-semibold text-black py-0.5 pl-0.5">{t('receipt.total')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-gray-300 last:border-0">
            <td className="align-top py-0.5 pr-1 text-black">{r.description}</td>
            <td className="text-right align-top py-0.5 text-black">{r.qty}</td>
            <td className="text-right align-top py-0.5 text-black whitespace-nowrap">{r.price}</td>
            <td className="text-right align-top py-0.5 text-black whitespace-nowrap font-medium">{r.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
