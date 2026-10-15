import { receiptPrintTitle } from '../constants/branding';
import type { StoreSettings } from './storeService';

export function getStoreDisplayName(settings: StoreSettings | null): string {
  if (!settings) return receiptPrintTitle(undefined, undefined);
  const raw = settings.name?.trim();
  if (raw) return raw;
  return receiptPrintTitle(settings.name, settings.code);
}

/** Updates USB customer pole display when running in Electron; no-op in browser or if disabled. */
export function showCustomerDisplay(storeName: string, amount: number): void {
  try {
    void window.electronAPI?.customerDisplayShow?.({ storeName, amount });
  } catch {
    /* ignore */
  }
}
