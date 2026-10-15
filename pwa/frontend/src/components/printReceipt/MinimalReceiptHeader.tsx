import { receiptPrintTitle } from '../../constants/branding';
import { API_BASE_URL } from '../../services/api';
import type { StoreSettings } from '../../services/storeService';

function MinimalReceiptLogo({ settings }: { settings: StoreSettings | null }) {
  if (!settings?.receipt_logo_url?.trim()) return null;
  return (
    <img
      src={`${API_BASE_URL}${settings.receipt_logo_url}`}
      alt="Logo"
      className="mx-auto mb-1.5 max-h-14 max-w-[60%] object-contain"
    />
  );
}

export function MinimalReceiptHeader({ settings }: { settings: StoreSettings | null }) {
  if (settings?.receipt_header?.trim()) {
    return (
      <div className="text-center mb-2 border-b border-black pb-2">
        <MinimalReceiptLogo settings={settings} />
        <div className="text-[11px] whitespace-pre-line leading-snug">
          {settings.receipt_header}
        </div>
      </div>
    );
  }

  const name = receiptPrintTitle(settings?.name, settings?.code);

  return (
    <div className="text-center mb-2 border-b border-black pb-2">
      <MinimalReceiptLogo settings={settings} />
      <div className="font-black text-[15px] tracking-tight leading-tight">{name}</div>
      {settings?.address?.trim() && (
        <div className="text-[10px] font-semibold mt-0.5 leading-snug" style={{ color: 'rgba(0,0,0,0.82)' }}>
          {settings.address}
        </div>
      )}
      {settings?.phone?.trim() && (
        <div className="text-[10px] font-semibold" style={{ color: 'rgba(0,0,0,0.82)' }}>
          {settings.phone}
        </div>
      )}
      <div
        className="text-[9px] font-semibold uppercase mt-2 tracking-[0.18em]"
        style={{ color: 'rgba(0,0,0,0.45)' }}
      >
        Sales Receipt
      </div>
    </div>
  );
}
