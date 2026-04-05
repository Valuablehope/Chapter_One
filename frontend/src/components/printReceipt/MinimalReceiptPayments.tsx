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
    <div className="text-xs space-y-0.5 border-t border-dashed border-black pt-1 mt-1">
      {payments.map((p, i) => (
        <div key={i} className="flex justify-between gap-2 text-black">
          <span>
            {t('receipt.payment', {
              method: p.method ? p.method.charAt(0).toUpperCase() + p.method.slice(1) : '',
            })}
          </span>
          <span className="font-mono font-medium">{formatCurrency(p.amount)}</span>
        </div>
      ))}
      {change > 0 && (
        <div className="flex justify-between gap-2 font-semibold text-black pt-0.5">
          <span>{t('receipt.change')}</span>
          <span className="font-mono">{formatCurrency(change)}</span>
        </div>
      )}
    </div>
  );
}
