import { receiptPrintTitle } from '../../constants/branding';
import { API_BASE_URL } from '../../services/api';
import type { StoreSettings } from '../../services/storeService';

function ModernReceiptLogo({ settings }: { settings: StoreSettings | null }) {
  if (!settings?.receipt_logo_url?.trim()) return null;
  return (
    <img
      src={`${API_BASE_URL}${settings.receipt_logo_url}`}
      alt="Logo"
      className="mx-auto mb-2 max-h-16 max-w-[65%] object-contain"
    />
  );
}

export function ModernReceiptHeader({ settings }: { settings: StoreSettings | null }) {
  if (settings?.receipt_header?.trim()) {
    return (
      <div className="text-center mb-3 pb-3 border-b border-dashed border-gray-400">
        <ModernReceiptLogo settings={settings} />
        <div className="text-[13px] whitespace-pre-line leading-relaxed">
          {settings.receipt_header}
        </div>
      </div>
    );
  }

  const name = receiptPrintTitle(settings?.name, settings?.code);

  return (
    <div className="text-center mb-3 pb-3 border-b border-dashed border-gray-400">
      <ModernReceiptLogo settings={settings} />
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
