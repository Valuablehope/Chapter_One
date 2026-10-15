import { useTranslation } from '../../i18n/I18nContext';

export function MinimalReceiptPayments({
  payments,
  grandTotal,
  formatCurrency,
}: {
  payments: { method: string; amount: number }[];
  grandTotal: number;
  formatCurrency: (n: number) => string;
}) {
  const { t } = useTranslation();
  const tender = Number(payments[0]?.amount ?? 0);
  const change = tender > grandTotal ? tender - grandTotal : 0;

  return (
    <div className="text-[11px] border-t border-dashed border-black pt-1.5 mt-1.5">
      {payments.map((p, i) => (
        <div key={i} className="flex justify-between gap-2 text-black leading-[1.65]">
          <span className="font-semibold" style={{ color: 'rgba(0,0,0,0.82)' }}>
            {t('receipt.payment', {
              method: p.method ? t(`pos_sales.${p.method}`) : '',
            })}
          </span>
          <span className="font-mono font-bold">{formatCurrency(p.amount)}</span>
        </div>
      ))}
      {change > 0 && (
        <div className="flex justify-between gap-2 font-bold text-black pt-0.5">
          <span>{t('receipt.change')}</span>
          <span className="font-mono">{formatCurrency(change)}</span>
        </div>
      )}
    </div>
  );
}
