import { useEffect, useCallback } from 'react';
import { getTheme, AppTheme } from '../styles/themes';

const THEME_STORAGE_KEY = 'pos-theme';

/**
 * Injects the theme CSS variables into the document root and the dynamic
 * Tailwind sidebar classes via a <style> tag.
 */
function applyTheme(theme: AppTheme): void {
  // 1. Override CSS custom properties on :root
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  // 2. Inject/update Tailwind sidebar color overrides via a style tag
  //    (Tailwind's `bg-sidebar-bg` etc. read from the config — we override
  //    them by injecting CSS that targets the Tailwind-generated class names)
  let styleTag = document.getElementById('pos-theme-overrides') as HTMLStyleElement | null;
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'pos-theme-overrides';
    document.head.appendChild(styleTag);
  }

  const s = theme.sidebar;
  const v = theme.vars;

  // Helper: get a var value with fallback
  const cv = (key: string) => v[key] ?? '';

  styleTag.textContent = `
    /* ── Chapter One POS — Active Theme: ${theme.id} ── */

    /* ── Sidebar ── */
    .bg-sidebar-bg          { background-color: ${s.bg}     !important; }
    .bg-sidebar-hover       { background-color: ${s.hover}  !important; }
    .bg-sidebar-active      { background-color: ${s.active} !important; }
    .border-sidebar-border  { border-color:     ${s.border} !important; }
    .text-sidebar-text      { color: ${s.text}  !important; }
    .text-sidebar-muted     { color: ${s.muted} !important; }

    /* ── Secondary backgrounds ── */
    .bg-secondary-50   { background-color: ${cv('--color-secondary-50')}  !important; }
    .bg-secondary-100  { background-color: ${cv('--color-secondary-100')} !important; }
    .bg-secondary-200  { background-color: ${cv('--color-secondary-200')} !important; }
    .bg-secondary-300  { background-color: ${cv('--color-secondary-300')} !important; }
    .bg-secondary-400  { background-color: ${cv('--color-secondary-400')} !important; }
    .bg-secondary-500  { background-color: ${cv('--color-secondary-500')} !important; }
    .bg-secondary-600  { background-color: ${cv('--color-secondary-600')} !important; }
    .bg-secondary-700  { background-color: ${cv('--color-secondary-700')} !important; }
    .bg-secondary-800  { background-color: ${cv('--color-secondary-800')} !important; }
    .bg-secondary-900  { background-color: ${cv('--color-secondary-900')} !important; }

    /* ── Secondary hover backgrounds ── */
    .hover\\:bg-secondary-50:hover   { background-color: ${cv('--color-secondary-50')}  !important; }
    .hover\\:bg-secondary-100:hover  { background-color: ${cv('--color-secondary-100')} !important; }
    .hover\\:bg-secondary-200:hover  { background-color: ${cv('--color-secondary-200')} !important; }
    .hover\\:bg-secondary-500:hover  { background-color: ${cv('--color-secondary-500')} !important; }
    .hover\\:bg-secondary-600:hover  { background-color: ${cv('--color-secondary-600')} !important; }
    .group:hover .group-hover\\:bg-secondary-50  { background-color: ${cv('--color-secondary-50')}  !important; }
    .group:hover .group-hover\\:bg-secondary-100 { background-color: ${cv('--color-secondary-100')} !important; }

    /* ── Secondary text ── */
    .text-secondary-400 { color: ${cv('--color-secondary-400')} !important; }
    .text-secondary-500 { color: ${cv('--color-secondary-500')} !important; }
    .text-secondary-600 { color: ${cv('--color-secondary-600')} !important; }
    .text-secondary-700 { color: ${cv('--color-secondary-700')} !important; }
    .text-secondary-800 { color: ${cv('--color-secondary-800')} !important; }
    .text-secondary-900 { color: ${cv('--color-secondary-900')} !important; }

    /* ── Secondary hover text ── */
    .hover\\:text-secondary-400:hover { color: ${cv('--color-secondary-400')} !important; }
    .hover\\:text-secondary-500:hover { color: ${cv('--color-secondary-500')} !important; }
    .hover\\:text-secondary-600:hover { color: ${cv('--color-secondary-600')} !important; }
    .group:hover .group-hover\\:text-secondary-500 { color: ${cv('--color-secondary-500')} !important; }
    .group:hover .group-hover\\:text-secondary-600 { color: ${cv('--color-secondary-600')} !important; }

    /* ── Secondary borders ── */
    .border-secondary-100 { border-color: ${cv('--color-secondary-100')} !important; }
    .border-secondary-200 { border-color: ${cv('--color-secondary-200')} !important; }
    .border-secondary-300 { border-color: ${cv('--color-secondary-300')} !important; }
    .border-secondary-400 { border-color: ${cv('--color-secondary-400')} !important; }
    .border-secondary-500 { border-color: ${cv('--color-secondary-500')} !important; }
    .border-secondary-600 { border-color: ${cv('--color-secondary-600')} !important; }

    /* ── Secondary hover borders ── */
    .hover\\:border-secondary-200:hover { border-color: ${cv('--color-secondary-200')} !important; }
    .hover\\:border-secondary-300:hover { border-color: ${cv('--color-secondary-300')} !important; }
    .hover\\:border-secondary-400:hover { border-color: ${cv('--color-secondary-400')} !important; }
    .hover\\:border-secondary-500:hover { border-color: ${cv('--color-secondary-500')} !important; }

    /* ── Secondary border-t (spinner top border) ── */
    .border-t-secondary-500 { border-top-color: ${cv('--color-secondary-500')} !important; }
    .border-t-secondary-600 { border-top-color: ${cv('--color-secondary-600')} !important; }

    /* ── Ring / focus-ring ── */
    .ring-secondary-500,
    .focus\\:ring-secondary-500:focus {
      --tw-ring-color: ${cv('--color-secondary-500')} !important;
    }
    .focus\\:border-secondary-500:focus { border-color: ${cv('--color-secondary-500')} !important; }

    /* ── Toggle (peer-checked) ── */
    .peer:checked ~ .peer-checked\\:bg-secondary-500 { background-color: ${cv('--color-secondary-500')} !important; }

    /* ── Active states (Button component) ── */
    .active\\:bg-secondary-100:active { background-color: ${cv('--color-secondary-100')} !important; }
    .active\\:bg-secondary-700:active { background-color: ${cv('--color-secondary-700')} !important; }

    /* ── Gradient from/to (Tailwind bg-gradient-to-br from/to-secondary-*) ── */
    .from-secondary-50 { --tw-gradient-from: ${cv('--color-secondary-50')} !important; }
    .to-secondary-50   { --tw-gradient-to:   ${cv('--color-secondary-50')} !important; }
    .hover\\:from-secondary-100:hover { --tw-gradient-from: ${cv('--color-secondary-100')} !important; }

    /* ── Active nav indicator bar ── */
    .bg-secondary-400  { background-color: ${cv('--color-secondary-400')} !important; }

    /* ── Global focus + input glow ── */
    *:focus-visible {
      outline-color: ${cv('--color-secondary-500')} !important;
    }
    input:focus, textarea:focus, select:focus {
      box-shadow:
        0 0 0 3px color-mix(in srgb, ${cv('--color-secondary-500')} 18%, transparent),
        0 0 16px color-mix(in srgb, ${cv('--color-secondary-500')} 7%, transparent) !important;
    }

    /* ── Selection ── */
    ::selection {
      background-color: ${cv('--color-secondary-200')} !important;
    }
  `;

  // Set --sidebar-bg so mobile sidebar inline var() also tracks the theme
  root.style.setProperty('--sidebar-bg', s.bg);

  // 3. Set data-theme attribute for any CSS selectors that need it
  document.documentElement.setAttribute('data-theme', theme.id);
}

/**
 * Hook that:
 * 1. Reads the stored theme from localStorage on mount
 * 2. Applies it immediately
 * 3. Returns a `setTheme(id)` function that persists + re-applies
 */
export function useTheme() {
  const setTheme = useCallback((themeId: string) => {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    applyTheme(getTheme(themeId));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) ?? 'classic';
    applyTheme(getTheme(stored));
  }, []);

  return { setTheme };
}

/** Read the currently active theme id (synchronous) */
export function getActiveThemeId(): string {
  return localStorage.getItem(THEME_STORAGE_KEY) ?? 'classic';
}
