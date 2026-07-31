import { useTranslation } from '../../i18n/I18nContext';

export function ModernReceiptPayments({
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
    <div className="text-[13px] border-t border-dashed border-gray-400 pt-2 mt-2 space-y-1">
      {payments.map((p, i) => (
        <div key={i} className="flex justify-between gap-3 leading-relaxed text-gray-500">
          <span>
            {t('receipt.payment', {
              method: p.method ? t(`pos_sales.${p.method}`) : '',
            })}
          </span>
          <span className="font-semibold text-gray-900">{formatCurrency(p.amount)}</span>
        </div>
      ))}
      {change > 0 && (
        <div className="flex justify-between gap-3 font-semibold text-gray-900">
          <span>{t('receipt.change')}</span>
          <span>{formatCurrency(change)}</span>
        </div>
      )}
    </div>
  );
}
