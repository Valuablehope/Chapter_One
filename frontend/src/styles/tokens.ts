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
  // Brand Blue (maps to Tailwind `secondary-*`)
  brand:           '#3582e2',   // secondary-500 — primary action colour
  brandDark:       '#2a68b5',   // secondary-600
  brandDeep:       '#1f4e88',   // secondary-700
  brandDeeper:     '#0f1c2e',   // secondary-900 / sidebar bg
  brandDarkest:    '#0a1a2e',   // banner gradient start
  brandLight:      '#e8f1fc',   // secondary-50  — tinted backgrounds
  brandDisabled:   '#93b8ef',   // muted blue — disabled button background
  brandAccent:     '#93c5fd',   // blue-300 — decorative highlight on dark bg
  brandAccentText: '#bfdbfe',   // blue-200 — readable text on dark bg

  // Semantic
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
  surfaceDim: '#f0f5ff',   // input resting bg
  surfaceAlt: '#f8fafc',   // subtle card bg
  bg:         '#f0f4fa',   // page background
  border:     '#e2e8f0',   // default border

  // Sidebar (dark shell)
  sidebarBg: '#0f1c2e',
} as const;

// ── Gradients ─────────────────────────────────────────────────────────────────

export const gradients = {
  /** Primary brand gradient — page banners, dashboard welcome card */
  brand: 'linear-gradient(135deg, #0a1a2e 0%, #1f4e88 60%, #3582e2 100%)',
  /** Blue-only gradient — totals panels, payment summary cards */
  brandBlue: 'linear-gradient(135deg, #3582e2 0%, #1f4e88 100%)',
} as const;

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
  /** Sidebar desktop drop-shadow */
  sidebar:       '4px 0 20px rgba(15,28,46,0.25)',
  /** Sidebar mobile drawer drop-shadow */
  sidebarMobile: '4px 0 20px rgba(15,28,46,0.35)',
} as const;

// ── Border Radius ─────────────────────────────────────────────────────────────

export const radii = {
  sm:   '4px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  '2xl':'20px',
} as const;
