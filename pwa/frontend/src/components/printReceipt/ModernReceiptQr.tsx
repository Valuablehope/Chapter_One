import { API_BASE_URL } from '../../services/api';

/**
 * Prints the store's uploaded "Scan to Pay" QR code image exactly as-is.
 * Deliberately does NOT regenerate/re-encode a QR from a link or phone number:
 * payment apps (Whish Money, etc.) only recognize their own proprietary QR
 * payload, so anything re-encoded here would look valid but fail to scan in
 * that app. Printing the merchant's own exported QR image guarantees it's
 * byte-for-byte what the payment app produced.
 */
export function ModernReceiptQr({ imageUrl }: { imageUrl?: string | null }) {
  if (!imageUrl?.trim()) return null;

  return (
    <div className="text-center mt-3 pt-3 border-t border-dashed border-gray-400">
      <p className="text-[12px] font-semibold text-gray-700 mb-2">Scan to Pay</p>
      <img
        src={`${API_BASE_URL}${imageUrl}`}
        alt="Scan to pay QR code"
        className="mx-auto w-28 h-28 object-contain"
      />
    </div>
  );
}
