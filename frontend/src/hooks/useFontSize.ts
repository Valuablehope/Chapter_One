import { useEffect, useCallback } from 'react';

export type FontSizeScale = 'sm' | 'md' | 'lg' | 'xl';

const HEADING_KEY = 'pos-heading-size';
const BODY_KEY    = 'pos-body-size';

/**
 * Pixel values for each Tailwind class at each scale.
 * 'md' entries are Tailwind's own defaults — we still inject them explicitly
 * so that switching back to 'md' correctly resets any prior override.
 */
const HEADING_PX: Record<FontSizeScale, Record<string, string>> = {
  sm: { 'text-xl': '15px', 'text-2xl': '18px', 'text-3xl': '20px', 'text-4xl': '24px', 'text-5xl': '28px' },
  md: { 'text-xl': '20px', 'text-2xl': '24px', 'text-3xl': '30px', 'text-4xl': '36px', 'text-5xl': '48px' },
  lg: { 'text-xl': '23px', 'text-2xl': '28px', 'text-3xl': '36px', 'text-4xl': '42px', 'text-5xl': '56px' },
  xl: { 'text-xl': '26px', 'text-2xl': '32px', 'text-3xl': '40px', 'text-4xl': '48px', 'text-5xl': '64px' },
};

const BODY_PX: Record<FontSizeScale, Record<string, string>> = {
  sm: { 'text-xs': '9px',  'text-sm': '11px', 'text-base': '12px', 'text-lg': '13px' },
  md: { 'text-xs': '12px', 'text-sm': '14px', 'text-base': '16px', 'text-lg': '18px' },
  lg: { 'text-xs': '13px', 'text-sm': '15px', 'text-base': '17px', 'text-lg': '20px' },
  xl: { 'text-xs': '14px', 'text-sm': '17px', 'text-base': '19px', 'text-lg': '22px' },
};

function buildCSS(headingScale: FontSizeScale, bodyScale: FontSizeScale): string {
  const hRules = Object.entries(HEADING_PX[headingScale])
    .map(([cls, px]) => `.${cls} { font-size: ${px} !important; }`)
    .join('\n');

  const bRules = Object.entries(BODY_PX[bodyScale])
    .map(([cls, px]) => `.${cls} { font-size: ${px} !important; }`)
    .join('\n');

  return `/* pos-font-overrides: heading=${headingScale} body=${bodyScale} */\n${hRules}\n${bRules}`;
}

function applyFontSizes(headingScale: FontSizeScale, bodyScale: FontSizeScale): void {
  // Set CSS custom property scale multipliers (for any calc()-based uses)
  const scaleMap: Record<FontSizeScale, number> = { sm: 0.875, md: 1, lg: 1.125, xl: 1.25 };
  document.documentElement.style.setProperty('--font-heading-scale', String(scaleMap[headingScale]));
  document.documentElement.style.setProperty('--font-body-scale',    String(scaleMap[bodyScale]));

  // Inject/update the Tailwind class override style tag
  let tag = document.getElementById('pos-font-overrides') as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'pos-font-overrides';
    document.head.appendChild(tag);
  }
  tag.textContent = buildCSS(headingScale, bodyScale);
}

export function useFontSize() {
  // Apply persisted font sizes on every mount
  useEffect(() => {
    const h = (localStorage.getItem(HEADING_KEY) ?? 'md') as FontSizeScale;
    const b = (localStorage.getItem(BODY_KEY)    ?? 'md') as FontSizeScale;
    applyFontSizes(h, b);
  }, []);

  const setFontSizes = useCallback((headingScale: FontSizeScale, bodyScale: FontSizeScale) => {
    localStorage.setItem(HEADING_KEY, headingScale);
    localStorage.setItem(BODY_KEY,    bodyScale);
    applyFontSizes(headingScale, bodyScale);
  }, []);

  return { setFontSizes };
}

export function getStoredFontSizes(): { heading: FontSizeScale; body: FontSizeScale } {
  return {
    heading: (localStorage.getItem(HEADING_KEY) ?? 'md') as FontSizeScale,
    body:    (localStorage.getItem(BODY_KEY)    ?? 'md') as FontSizeScale,
  };
}
