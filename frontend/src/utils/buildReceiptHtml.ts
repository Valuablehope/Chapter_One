import type { StoreSettings } from '../services/storeService';
import type { Customer } from '../services/customerService';
import { receiptPrintTitle } from '../constants/branding';
import { formatLbpGrand, formatLbpPlain } from '../components/printReceipt';

function esc(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generates a fully self-contained receipt HTML string with inline styles.
 * Mirrors the MinimalReceipt* React components exactly so silent Electron
 * prints and browser window.print() receipts look identical.
 */
export function buildReceiptHtml(params: {
  sale: any;
  settings: StoreSettings | null;
  items: any[];
  customer: Customer | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}): string {
  const { sale, settings, items, customer, t } = params;

  const paperSize = settings?.paper_size || '80mm';

  const currency = settings?.currency_code || 'USD';
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const formatDate = (ds: string) => {
    const tz = settings?.timezone || 'UTC';
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: tz,
      }).format(new Date(ds));
    } catch {
      return new Date(ds).toLocaleString();
    }
  };

  // ── Calculations (mirror Receipt.tsx) ──────────────────────────────────────
  const deliveryCharge = Number(sale.delivery_charge || 0);
  const drawerTotal    = Number(sale.grand_total     || 0);
  const subtotal       = Number(sale.subtotal        || 0);
  const taxTotal       = Number(sale.tax_total       || 0);
  const discountTotal  = Number(sale.discount_total  || 0);

  const inDrawer = settings?.include_delivery_in_drawer !== false;
  const merchTotal = subtotal + (settings?.tax_inclusive ? 0 : taxTotal) - discountTotal;
  const wasSavedWithDelivery =
    deliveryCharge > 0 &&
    Math.abs(drawerTotal - (merchTotal + deliveryCharge)) <
      Math.abs(drawerTotal - merchTotal);
  const invoiceTotal = wasSavedWithDelivery ? drawerTotal : drawerTotal + deliveryCharge;

  const lbp =
    settings?.show_lbp_price !== false
      ? formatLbpGrand(invoiceTotal, settings?.lbp_exchange_rate, settings?.round_lbp_to_1000)
      : null;

  // ── Line rows ──────────────────────────────────────────────────────────────
  const lineRows = items.map((item) => {
    const isReturn = !!(item as any).is_return;
    const absTotal = Math.abs(Number(item.line_total));
    return {
      description: item.product?.name || (item as any).product_name || '—',
      qty:   isReturn ? `-${Number(item.qty)}`                      : String(Number(item.qty)),
      price: formatCurrency(Number(item.unit_price)),
      total: isReturn ? `-${formatCurrency(absTotal)}`              : formatCurrency(absTotal),
      isReturn,
    };
  });

  // ── Total rows ─────────────────────────────────────────────────────────────
  interface TR { label: string; value: string; style: 'normal' | 'strong' | 'strongSub' }
  const totalRows: TR[] = [];

  if (settings?.tax_inclusive) {
    totalRows.push({ label: t('receipt.subtotal'), value: formatCurrency(subtotal + taxTotal), style: 'normal' });
  } else {
    totalRows.push({ label: t('receipt.subtotal'), value: formatCurrency(subtotal), style: 'normal' });
    if (taxTotal > 0)
      totalRows.push({ label: t('receipt.tax'), value: formatCurrency(taxTotal), style: 'normal' });
  }

  if (discountTotal > 0) {
    const dl =
      sale.discount_rate != null && Number(sale.discount_rate) > 0
        ? `${t('receipt.discount')} (${sale.discount_rate}%)`
        : t('receipt.discount');
    totalRows.push({ label: dl, value: `-${formatCurrency(discountTotal)}`, style: 'normal' });
  }

  if (deliveryCharge > 0) {
    const dl = inDrawer
      ? t('receipt.delivery')
      : `${t('receipt.delivery')} (${t('receipt.not_in_drawer')})`;
    totalRows.push({ label: dl, value: formatCurrency(deliveryCharge), style: 'normal' });
  }

  totalRows.push({ label: t('receipt.net_total'), value: formatCurrency(invoiceTotal), style: 'strong' });

  if (lbp != null)
    totalRows.push({ label: t('receipt.net_total_lbp'), value: `${formatLbpPlain(lbp)} LBP`, style: 'strongSub' });

  // ── Meta rows ──────────────────────────────────────────────────────────────
  const metaRows: { label: string; value: string }[] = [
    { label: t('receipt.receipt_no'), value: String(sale.receipt_no) },
    { label: t('receipt.date'),       value: formatDate(sale.created_at) },
  ];
  const cust = customer ?? sale.customer ?? null;
  if (cust?.full_name?.trim())
    metaRows.push({ label: t('receipt.customer'), value: cust.full_name.trim() });

  // ── Payments ───────────────────────────────────────────────────────────────
  const rawPay: { method: string; amount: number | string }[] = Array.isArray(sale.payments)
    ? sale.payments
    : [];
  const payments = rawPay.map((p) => ({ method: p.method, amount: Number(p.amount) }));
  if (!wasSavedWithDelivery && deliveryCharge > 0) {
    const idx = payments.findIndex((p) => p.method?.toLowerCase() === 'cash');
    if (idx !== -1) payments[idx].amount += deliveryCharge;
    else            payments.push({ method: 'cash', amount: deliveryCharge });
  }
  const tender = payments[0]?.amount ?? 0;
  const change = tender > invoiceTotal ? tender - invoiceTotal : 0;

  // ── HTML fragments ─────────────────────────────────────────────────────────

  // Header — mirrors MinimalReceiptHeader
  let headerHtml: string;
  if (settings?.receipt_header?.trim()) {
    headerHtml = `
      <div style="text-align:center;font-size:11px;white-space:pre-line;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid #000;line-height:1.4">
        ${esc(settings.receipt_header)}
      </div>`;
  } else {
    const name = receiptPrintTitle(settings?.name, settings?.code);
    let inner = `<div style="font-size:15px;font-weight:900;letter-spacing:-0.3px;line-height:1.2">${esc(name)}</div>`;
    if (settings?.address?.trim())
      inner += `<div style="font-size:10px;font-weight:600;line-height:1.4;color:rgba(0,0,0,0.82);margin-top:2px">${esc(settings.address)}</div>`;
    if (settings?.phone?.trim())
      inner += `<div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.82)">${esc(settings.phone)}</div>`;
    inner += `<div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.18em;color:rgba(0,0,0,0.45);margin-top:6px">Sales Receipt</div>`;
    headerHtml = `
      <div style="text-align:center;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid #000">
        ${inner}
      </div>`;
  }

  // Meta rows — mirrors MinimalReceiptMeta
  const metaHtml = metaRows
    .map(
      (r) => `
      <div style="display:flex;justify-content:space-between;gap:8px;line-height:1.65">
        <span style="flex:1;min-width:0;font-weight:600;color:rgba(0,0,0,0.75)">${esc(r.label)}</span>
        <span style="font-family:monospace;font-weight:700;white-space:nowrap;text-align:right">${esc(r.value)}</span>
      </div>`,
    )
    .join('');

  // Line items — mirrors MinimalReceiptLineTable
  const lineHtml = lineRows
    .map((r, i) => {
      const last   = i === lineRows.length - 1;
      const color  = r.isReturn ? 'color:#dc2626;' : 'color:#000;';
      const border = last ? '' : 'border-bottom:1px solid #e5e7eb;';
      return `
        <tr style="${border}">
          <td style="padding:4px 4px 4px 0;vertical-align:top;font-weight:600;${color}">
            ${esc(r.description)}
            ${r.isReturn ? '<span style="font-size:9px;font-weight:700;text-transform:uppercase;margin-left:3px;letter-spacing:0.05em">(Return)</span>' : ''}
          </td>
          <td style="text-align:right;vertical-align:top;padding:4px 2px;white-space:nowrap;font-weight:600;${color}">${esc(r.qty)}</td>
          <td style="text-align:right;vertical-align:top;padding:4px 2px;white-space:nowrap;font-weight:600;${color}">${esc(r.price)}</td>
          <td style="text-align:right;vertical-align:top;padding:4px 0 4px 2px;white-space:nowrap;font-weight:700;${color}">${esc(r.total)}</td>
        </tr>`;
    })
    .join('');

  // Total rows — mirrors MinimalReceiptTotals
  const totalsHtml = totalRows
    .map((r) => {
      if (r.style === 'strong') {
        return `
          <div style="display:flex;justify-content:space-between;gap:8px;font-weight:900;font-size:13px;border-top:2px solid #000;margin-top:6px;padding-top:6px;">
            <span style="text-transform:uppercase;letter-spacing:0.04em">${esc(r.label)}</span>
            <span style="font-family:monospace;white-space:nowrap;text-align:right">${esc(r.value)}</span>
          </div>`;
      }
      if (r.style === 'strongSub') {
        return `
          <div style="display:flex;justify-content:space-between;gap:8px;font-weight:700;font-size:12px;line-height:1.5">
            <span>${esc(r.label)}</span>
            <span style="font-family:monospace;white-space:nowrap;text-align:right">${esc(r.value)}</span>
          </div>`;
      }
      return `
        <div style="display:flex;justify-content:space-between;gap:8px;line-height:1.65;color:#000;font-weight:600">
          <span>${esc(r.label)}</span>
          <span style="font-family:monospace;white-space:nowrap;text-align:right">${esc(r.value)}</span>
        </div>`;
    })
    .join('');

  // Payment rows — mirrors MinimalReceiptPayments
  const paymentsHtml =
    payments.length > 0
      ? `
        <div style="border-top:1px dashed #000;padding-top:6px;margin-top:6px">
          ${payments
            .map((p) => {
              const methodName = p.method ? t(`pos_sales.${p.method}`) : '';
              const label = t('receipt.payment', { method: methodName });
              return `
                <div style="display:flex;justify-content:space-between;gap:8px;line-height:1.65">
                  <span style="font-weight:600;color:rgba(0,0,0,0.82)">${esc(label)}</span>
                  <span style="font-family:monospace;font-weight:700">${esc(formatCurrency(p.amount))}</span>
                </div>`;
            })
            .join('')}
          ${change > 0
            ? `<div style="display:flex;justify-content:space-between;gap:8px;font-weight:700;padding-top:2px;line-height:1.65">
                <span>${esc(t('receipt.change'))}</span>
                <span style="font-family:monospace">${esc(formatCurrency(change))}</span>
              </div>`
            : ''}
        </div>`
      : '';

  // Footer — mirrors MinimalReceiptFooter
  let footerContent: string;
  if (settings?.receipt_footer?.trim()) {
    footerContent = `<div style="font-size:11px;white-space:pre-line;line-height:1.4">${esc(settings.receipt_footer)}</div>`;
  } else {
    footerContent = `<p style="font-weight:700;font-size:11px">${esc(t('receipt.thank_you_sale'))}</p>`;
  }

  // ── Final HTML ─────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: ${paperSize} auto; margin: 0; }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      font-weight: 600;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 8px;
      width: ${paperSize};
    }
    table { border-collapse: collapse; }
    p { margin: 0; }
  </style>
</head>
<body>
  ${headerHtml}
  <div style="margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #000">${metaHtml}</div>
  <table style="width:100%;font-size:11px;margin-bottom:6px">
    <thead>
      <tr style="border-bottom:1px solid #000">
        <th style="text-align:left;font-weight:700;padding:4px 4px 4px 0">${esc(t('receipt.description'))}</th>
        <th style="text-align:right;font-weight:700;padding:4px 2px;width:2.25rem">${esc(t('receipt.qty'))}</th>
        <th style="text-align:right;font-weight:700;padding:4px 2px">${esc(t('receipt.price'))}</th>
        <th style="text-align:right;font-weight:700;padding:4px 0 4px 2px">${esc(t('receipt.total'))}</th>
      </tr>
    </thead>
    <tbody>${lineHtml}</tbody>
  </table>
  <div style="border-top:1px solid #000;padding-top:4px;margin-top:2px">
    ${totalsHtml}
  </div>
  ${paymentsHtml}
  <div style="border-top:1px solid #000;padding-top:8px;margin-top:8px;text-align:center">
    ${footerContent}
    <p style="font-size:9px;color:rgba(0,0,0,0.42);margin-top:8px;letter-spacing:0.05em">${esc(t('receipt.by_cubiq'))}</p>
  </div>
</body>
</html>`;
}
