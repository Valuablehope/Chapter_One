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

  const deliveryCharge = Number(sale.delivery_charge || 0);
  const inDrawer = settings?.include_delivery_in_drawer !== false;
  const drawerTotal = Number(sale.grand_total || 0);
  const subtotal = Number(sale.subtotal || 0);
  const taxTotal = Number(sale.tax_total || 0);
  const discountTotal = Number(sale.discount_total || 0);

  // Robust heuristic: Check if this specific sale was saved with delivery already in its grand_total.
  // We compare the saved grand_total (drawerTotal) against the calculated merchandise total 
  // with and without delivery to see which one it matches more closely.
  const merchTotal = subtotal + (settings?.tax_inclusive ? 0 : taxTotal) - discountTotal;
  const wasSavedWithDelivery = deliveryCharge > 0 && 
    Math.abs(drawerTotal - (merchTotal + deliveryCharge)) < Math.abs(drawerTotal - merchTotal);
  
  const invoiceTotal = wasSavedWithDelivery ? drawerTotal : (drawerTotal + deliveryCharge);

  const lbp = settings?.show_lbp_price !== false
    ? formatLbpGrand(invoiceTotal, settings?.lbp_exchange_rate, settings?.round_lbp_to_1000)
    : null;

  const lineRows = items.map((item) => {
    const isReturn = !!(item as any).is_return;
    const absTotal = Math.abs(Number(item.line_total));
    return {
      description: item.product?.name || (item as any).product_name || '—',
      qty: isReturn ? `-${Number(item.qty)}` : Number(item.qty).toString(),
      price: formatCurrency(Number(item.unit_price)),
      total: isReturn ? `-${formatCurrency(absTotal)}` : formatCurrency(absTotal),
      isReturn,
    };
  });

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

  if (deliveryCharge > 0) {
    totalRows.push({
      label: inDrawer ? t('receipt.delivery') : `${t('receipt.delivery')} (${t('receipt.not_in_drawer')})`,
      value: formatCurrency(deliveryCharge),
    });
  }

  totalRows.push({
    label: t('receipt.net_total'),
    value: formatCurrency(invoiceTotal),
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

  const rawPayments: { method: string; amount: number | string }[] = Array.isArray(sale.payments) ? sale.payments : [];
  const payments = [...rawPayments.map(p => ({ ...p, amount: Number(p.amount) }))];

  // If delivery was not in the drawer, virtually add it to the cash payment 
  // on the receipt so the customer sees they paid the full Net Total.
  if (!wasSavedWithDelivery && deliveryCharge > 0) {
    const cashIdx = payments.findIndex(p => p.method?.toLowerCase() === 'cash');
    if (cashIdx !== -1) {
      payments[cashIdx].amount += deliveryCharge;
    } else {
      payments.push({ method: 'cash', amount: deliveryCharge });
    }
  }

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
            grandTotal={invoiceTotal}
            formatCurrency={formatCurrency}
          />
        )}
        <MinimalReceiptFooter settings={settings} variant="sale" />
      </div>
    </div>
  );
}
