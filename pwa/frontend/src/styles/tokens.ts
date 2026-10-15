/**
 * Design Tokens — Chapter One POS
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for ALL hardcoded design values used in inline styles.
 *
 * USAGE RULES:
 *  • Always prefer Tailwind utility classes (e.g. `text-secondary-500`) when
 *    a value can be expressed that way.
 *  • Import from this file ONLY for values that must live in inline `style={{}}`
 *    props — e.g. dynamic colours, CSS gradients, box-shadow strings.
 *  • Never introduce a new magic string or hex colour anywhere in the codebase
 *    without first adding it here.
 *
 * Every value here must have a corresponding CSS custom property in index.css.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Colors ───────────────────────────────────────────────────────────────────

export const colors = {
  // Brand (maps to Tailwind `secondary-*`) — dynamic CSS var getters
  get brand()           { return getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-500').trim() || '#3582e2'; },
  get brandDark()       { return getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-600').trim() || '#2a68b5'; },
  get brandDeep()       { return getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-700').trim() || '#1f4e88'; },
  get brandDeeper()     { return getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-900').trim() || '#0f1c2e'; },
  get brandDarkest()    { return getComputedStyle(document.documentElement).getPropertyValue('--color-brand-dark').trim()    || '#0a1a2e'; },
  get brandLight()      { return getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-50').trim()  || '#e8f1fc'; },
  get brandDisabled()   { return getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-300').trim() || '#93b8ef'; },
  get brandAccent()     { return getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-300').trim() || '#93c5fd'; },
  get brandAccentText() { return getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-200').trim() || '#bfdbfe'; },

  // Semantic — these don't change with themes
  success:      '#10B981',
  successLight: '#ECFDF5',
  warning:      '#D97706',
  warningLight: '#FFFBEB',
  error:        '#EF4444',
  errorLight:   '#FEF2F2',

  // Text
  textPrimary: '#0f172a',
  textMuted:   '#b0b8c8',

  // Surfaces & borders
  surface:    '#FFFFFF',
  surfaceDim: '#f0f5ff',
  surfaceAlt: '#f8fafc',
  get bg()    { return getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#f0f4fa'; },
  border:     '#e2e8f0',

  // Sidebar (dark shell)
  get sidebarBg() { return getComputedStyle(document.documentElement).getPropertyValue('--sidebar-bg').trim() || '#0f1c2e'; },
} as {
  brand: string; brandDark: string; brandDeep: string; brandDeeper: string;
  brandDarkest: string; brandLight: string; brandDisabled: string;
  brandAccent: string; brandAccentText: string;
  success: string; successLight: string; warning: string; warningLight: string;
  error: string; errorLight: string; textPrimary: string; textMuted: string;
  surface: string; surfaceDim: string; surfaceAlt: string; bg: string;
  border: string; sidebarBg: string;
};

// ── Gradients ─────────────────────────────────────────────────────────────────
// NOTE: These are functions so they read the *current* CSS custom property at
// render time, which means all active themes are reflected automatically.

export const gradients = {
  /** Primary brand gradient — page banners, dashboard welcome card */
  get brand() { return getComputedStyle(document.documentElement).getPropertyValue('--gradient-brand').trim() || 'linear-gradient(135deg, #0a1a2e 0%, #1f4e88 60%, #3582e2 100%)'; },
  /** Blue-only gradient — totals panels, payment summary cards */
  get brandBlue() { return getComputedStyle(document.documentElement).getPropertyValue('--gradient-brand-blue').trim() || 'linear-gradient(135deg, #3582e2 0%, #1f4e88 100%)'; },
} as { brand: string; brandBlue: string };

// ── Typography ────────────────────────────────────────────────────────────────

export const fonts = {
  sans:    "'DM Sans', system-ui, -apple-system, sans-serif",
  display: "'Playfair Display', Georgia, serif",
  mono:    "'JetBrains Mono', 'Fira Code', monospace",
} as const;

/**
 * Font-size scale (px).
 * Prefer Tailwind text-* classes. Use these only inside inline style={{ fontSize }}.
 */
export const fontSizes = {
  '2xs': '10px',
  xs:    '11px',
  sm:    '12px',
  base:  '13px',
  md:    '14px',
  lg:    '15px',
  xl:    '16px',
  '2xl': '18px',
  '3xl': '20px',
  '4xl': '24px',
  '5xl': '30px',
} as const;

// ── Shadows ───────────────────────────────────────────────────────────────────

export const shadows = {
  /** Sidebar desktop drop-shadow — reads from CSS var set by theme */
  get sidebar()       { return getComputedStyle(document.documentElement).getPropertyValue('--shadow-sidebar').trim()        || '4px 0 20px rgba(15,28,46,0.25)'; },
  /** Sidebar mobile drawer drop-shadow */
  get sidebarMobile() { return getComputedStyle(document.documentElement).getPropertyValue('--shadow-sidebar-mobile').trim() || '4px 0 20px rgba(15,28,46,0.35)'; },
} as { sidebar: string; sidebarMobile: string };

// ── Border Radius ─────────────────────────────────────────────────────────────

export const radii = {
  sm:   '4px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  '2xl':'20px',
} as const;
