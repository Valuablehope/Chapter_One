import { useCallback, useEffect, useState } from 'react';

const PRINTER_STORAGE_KEY = 'pos-receipt-printer';
const SEEDED_FLAG_KEY = 'pos-receipt-printer-seeded';

/**
 * Which receipt printer THIS machine uses — local to the terminal, never
 * synced from the shared store settings (each till can be plugged into a
 * different printer). Seeds itself once from the legacy store-wide
 * `store_settings.receipt_printer` value so existing single-PC installs
 * don't see their printer choice silently reset to blank.
 */
export function useLocalPrinterPreference(legacyStoreWideValue?: string | null) {
  const [printer, setPrinterState] = useState<string>(() => localStorage.getItem(PRINTER_STORAGE_KEY) || '');

  useEffect(() => {
    if (localStorage.getItem(SEEDED_FLAG_KEY)) return;
    if (legacyStoreWideValue === undefined) return; // not loaded yet — wait for it
    localStorage.setItem(SEEDED_FLAG_KEY, 'true');
    if (legacyStoreWideValue && !localStorage.getItem(PRINTER_STORAGE_KEY)) {
      localStorage.setItem(PRINTER_STORAGE_KEY, legacyStoreWideValue);
      setPrinterState(legacyStoreWideValue);
    }
  }, [legacyStoreWideValue]);

  const setPrinter = useCallback((printerName: string) => {
    localStorage.setItem(PRINTER_STORAGE_KEY, printerName);
    setPrinterState(printerName);
  }, []);

  return { printer, setPrinter };
}
