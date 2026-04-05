import { StoreSettings } from '../services/storeService';
import { Customer } from '../services/customerService';
import { CartItem } from '../services/saleService';
import { useTranslation } from '../i18n/I18nContext';
import {
  MinimalReceiptHeader,
  MinimalReceiptMeta,
  MinimalReceiptLineTable,
  MinimalReceiptTotals,
  type TotalRow,
  MinimalReceiptFooter,
  MinimalReceiptPayments,
  formatLbpGrand,
  formatLbpPlain,
} from './printReceipt';

interface ReceiptProps {
  settings: StoreSettings | null;
  sale: any;
  customer: Customer | null;
  items: CartItem[];
}

export default function Receipt({ settings, sale, customer, items }: ReceiptProps) {
  const { t } = useTranslation();

  const formatCurrency = (amount: number) => {
    const currency = settings?.currency_code || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const timezone = settings?.timezone || 'UTC';
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone,
      }).format(new Date(dateString));
    } catch {
      return new Date(dateString).toLocaleString();
    }
  };

  if (!sale) return null;

  const grand = Number(sale.grand_total);
  const lbp = formatLbpGrand(grand, settings?.lbp_exchange_rate);

  const lineRows = items.map((item) => ({
    description: item.product?.name || (item as any).product_name || '—',
    qty: Number(item.qty).toString(),
    price: formatCurrency(Number(item.unit_price)),
    total: formatCurrency(Number(item.line_total)),
  }));

  const totalRows: TotalRow[] = [];

  if (settings?.tax_inclusive) {
    const merchandise = Number(sale.subtotal) + Number(sale.tax_total);
    totalRows.push({
      label: t('receipt.subtotal'),
      value: formatCurrency(merchandise),
    });
  } else {
    totalRows.push({
      label: t('receipt.subtotal'),
      value: formatCurrency(Number(sale.subtotal)),
    });
    if (Number(sale.tax_total) > 0) {
      totalRows.push({
        label: t('receipt.tax'),
        value: formatCurrency(Number(sale.tax_total)),
      });
    }
  }

  if (Number(sale.discount_total) > 0) {
    const discLabel =
      sale.discount_rate != null && Number(sale.discount_rate) > 0
        ? `${t('receipt.discount')} (${sale.discount_rate}%)`
        : t('receipt.discount');
    totalRows.push({
      label: discLabel,
      value: `-${formatCurrency(Number(sale.discount_total))}`,
    });
  }

  totalRows.push({
    label: t('receipt.net_total'),
    value: formatCurrency(grand),
    emphasis: 'strong',
  });

  if (lbp != null) {
    totalRows.push({
      label: t('receipt.net_total_lbp'),
      value: `${formatLbpPlain(lbp)} LBP`,
      emphasis: 'strongSub',
    });
  }

  const metaRows = [
    { label: t('receipt.receipt_no'), value: String(sale.receipt_no) },
    { label: t('receipt.date'), value: formatDate(sale.created_at) },
  ];

  if (customer?.full_name?.trim()) {
    metaRows.push({
      label: t('receipt.customer'),
      value: customer.full_name.trim(),
    });
  }

  const payments = Array.isArray(sale.payments) ? sale.payments : [];

  return (
    <div className="bg-white print:shadow-none">
      <div className="receipt-container receipt-print-root max-w-[80mm] mx-auto print:p-2 p-4 bg-white text-black">
        <MinimalReceiptHeader settings={settings} />
        <MinimalReceiptMeta rows={metaRows} />
        <MinimalReceiptLineTable rows={lineRows} />
        <MinimalReceiptTotals rows={totalRows} />
        {payments.length > 0 && (
          <MinimalReceiptPayments
            payments={payments}
            grandTotal={grand}
            formatCurrency={formatCurrency}
          />
        )}
        <MinimalReceiptFooter settings={settings} variant="sale" />
      </div>
    </div>
  );
}
