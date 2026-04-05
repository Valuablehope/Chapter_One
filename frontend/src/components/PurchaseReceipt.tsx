import { StoreSettings } from '../services/storeService';
import { Supplier } from '../services/supplierService';
import { PurchaseOrder } from '../services/purchaseService';
import { receiptPrimaryLine } from '../constants/branding';
import { useTranslation } from '../i18n/I18nContext';
import {
  MinimalReceiptMeta,
  MinimalReceiptLineTable,
  MinimalReceiptTotals,
  type TotalRow,
  MinimalReceiptFooter,
  formatLbpGrand,
  formatLbpPlain,
} from './printReceipt';

interface PurchaseReceiptProps {
  settings: StoreSettings | null;
  purchaseOrder: PurchaseOrder;
  supplier: Supplier | null;
}

/**
 * Header uses `receiptPrimaryLine` when no custom `receipt_header`: prefer non-legacy store name (aligned with purchases branding).
 */
function PurchaseReceiptHeader({ settings }: { settings: StoreSettings | null }) {
  if (settings?.receipt_header?.trim()) {
    return (
      <div className="text-center text-xs whitespace-pre-line mb-2 border-b border-black pb-2 leading-snug">
        {settings.receipt_header}
      </div>
    );
  }

  return (
    <div className="text-center mb-2 border-b border-black pb-2 space-y-0.5">
      <div className="font-bold text-sm">{receiptPrimaryLine(settings?.name, settings?.code)}</div>
      {settings?.address?.trim() && <div className="text-xs leading-snug">{settings.address}</div>}
      {settings?.phone?.trim() && <div className="text-xs">{settings.phone}</div>}
    </div>
  );
}

export default function PurchaseReceipt({ settings, purchaseOrder, supplier }: PurchaseReceiptProps) {
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

  if (!purchaseOrder) return null;

  const grand = Number(purchaseOrder.total_cost);
  const lbp = formatLbpGrand(grand, settings?.lbp_exchange_rate);

  const metaRows = [
    { label: t('receipt.po_no'), value: purchaseOrder.po_number || '—' },
    { label: t('receipt.date'), value: formatDate(purchaseOrder.ordered_at || new Date().toISOString()) },
  ];

  if (purchaseOrder.expected_at) {
    metaRows.push({
      label: t('receipt.expected_delivery'),
      value: new Date(purchaseOrder.expected_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: settings?.timezone || undefined,
      }),
    });
  }

  metaRows.push({
    label: t('receipt.status'),
    value: String(purchaseOrder.status),
  });

  if (supplier?.name?.trim()) {
    metaRows.push({
      label: t('receipt.supplier'),
      value: supplier.name.trim(),
    });
  }

  const lineRows = purchaseOrder.items.map((item) => {
    const lineTotal = item.qty_ordered * item.unit_cost;
    return {
      description: item.product_name || `Product ${item.product_id.slice(0, 8)}…`,
      qty: Number(item.qty_ordered).toString(),
      price: formatCurrency(item.unit_cost),
      total: formatCurrency(lineTotal),
    };
  });

  const totalRows: TotalRow[] = [
    {
      label: t('receipt.net_total'),
      value: formatCurrency(grand),
      emphasis: 'strong',
    },
  ];

  if (lbp != null) {
    totalRows.push({
      label: t('receipt.net_total_lbp'),
      value: `${formatLbpPlain(lbp)} LBP`,
      emphasis: 'strongSub',
    });
  }

  return (
    <div className="bg-white print:shadow-none">
      <div className="receipt-container-po receipt-print-root max-w-[80mm] mx-auto print:p-2 p-4 bg-white text-black">
        <PurchaseReceiptHeader settings={settings} />
        <MinimalReceiptMeta rows={metaRows} />
        <MinimalReceiptLineTable rows={lineRows} />
        <MinimalReceiptTotals rows={totalRows} />
        <MinimalReceiptFooter settings={settings} variant="sale" />
      </div>
    </div>
  );
}
