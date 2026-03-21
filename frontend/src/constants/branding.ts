/** Product name shown in shell UI (sidebar, login, splash, dashboard). */
export const APP_BRAND_NAME = 'Chapter One';

/** Full product line e.g. for headers — avoids duplicating " POS" in templates. */
export const APP_BRAND_POS_LINE = `${APP_BRAND_NAME} POS`;

const LEGACY_STORE_NAMES = [/^supermarket$/i, /^supermarket\s+pos$/i];

function isLegacyDefaultStoreName(name: string): boolean {
  const t = name.trim();
  return LEGACY_STORE_NAMES.some((re) => re.test(t));
}

/** Receipt / print header when only a store `name` is available. */
export function receiptHeaderStoreName(name?: string | null): string {
  const t = name?.trim();
  if (!t || isLegacyDefaultStoreName(t)) return APP_BRAND_NAME;
  return t;
}

/** Purchase receipt: prefer non-legacy name, else code, else brand. */
export function receiptPrimaryLine(name?: string | null, code?: string | null): string {
  const t = name?.trim();
  if (t && !isLegacyDefaultStoreName(t)) return t;
  if (code?.trim()) return code.trim();
  return APP_BRAND_NAME;
}
