import { receiptPrintTitle } from '../../constants/branding';
import type { StoreSettings } from '../../services/storeService';

/**
 * When `receipt_header` is set, it replaces the default name/address/phone block (parity with legacy receipts).
 */
export function MinimalReceiptHeader({ settings }: { settings: StoreSettings | null }) {
  if (settings?.receipt_header?.trim()) {
    return (
      <div className="text-center text-xs whitespace-pre-line mb-2 border-b border-black pb-2 leading-snug">
        {settings.receipt_header}
      </div>
    );
  }

  return (
    <div className="text-center mb-2 border-b border-black pb-2 space-y-0.5">
      <div className="font-bold text-sm">{receiptPrintTitle(settings?.name, settings?.code)}</div>
      {settings?.address?.trim() && <div className="text-xs leading-snug">{settings.address}</div>}
      {settings?.phone?.trim() && <div className="text-xs">{settings.phone}</div>}
    </div>
  );
}
