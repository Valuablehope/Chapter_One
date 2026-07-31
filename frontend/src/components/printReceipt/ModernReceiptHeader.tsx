import { receiptPrintTitle } from '../../constants/branding';
import type { StoreSettings } from '../../services/storeService';

export function ModernReceiptHeader({ settings }: { settings: StoreSettings | null }) {
  if (settings?.receipt_header?.trim()) {
    return (
      <div className="text-center text-[13px] whitespace-pre-line mb-3 pb-3 border-b border-dashed border-gray-400 leading-relaxed">
        {settings.receipt_header}
      </div>
    );
  }

  const name = receiptPrintTitle(settings?.name, settings?.code);

  return (
    <div className="text-center mb-3 pb-3 border-b border-dashed border-gray-400">
      <div className="font-bold text-[19px] tracking-tight leading-snug text-gray-900">{name}</div>
      {settings?.address?.trim() && (
        <div className="text-[12px] mt-1 leading-relaxed text-gray-600">{settings.address}</div>
      )}
      {settings?.phone?.trim() && (
        <div className="text-[12px] leading-relaxed text-gray-600">{settings.phone}</div>
      )}
    </div>
  );
}
