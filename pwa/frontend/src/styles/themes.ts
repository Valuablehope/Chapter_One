/**
 * Theme Definitions — Chapter One POS
 * ─────────────────────────────────────────────────────────────────────────────
 * Each theme overrides the CSS custom properties defined in :root (index.css).
 * Themes are applied by injecting a <style> tag with :root overrides.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface AppTheme {
  id: string;
  name: string;
  description: string;
  /** Preview swatch colors shown in the picker */
  swatches: string[];
  /** CSS variables to override on :root */
  vars: Record<string, string>;
  /** Tailwind-compatible sidebar color overrides (applied via data-theme attr) */
  sidebar: {
    bg: string;
    hover: string;
    active: string;
    border: string;
    text: string;
    muted: string;
  };
}

/**
 * Chrome foregrounds for the four themes whose sidebar and banners are dark
 * enough to carry white text. Every theme must spread or restate these keys:
 * applyTheme() sets the vars it is given but never clears the ones it isn't,
 * so a missing key would silently inherit the previously active theme's value.
 * Values match index.css's :root defaults, i.e. the original look.
 */
const DARK_CHROME = {
  '--chrome-fg':               '#ffffff',
  '--chrome-fg-soft':          '#75abed',
  '--chrome-danger-fg':        '#fca5a5',
  '--chrome-active-fg':        '#ffffff',
  '--chrome-overlay':          'rgba(255,255,255,0.10)',
  '--on-brand-fg':             '#ffffff',
  '--on-brand-fg-muted':       'rgba(255,255,255,0.62)',
  '--on-brand-overlay':        'rgba(255,255,255,0.12)',
  '--on-brand-overlay-border': 'rgba(255,255,255,0.15)',
};

export const THEMES: AppTheme[] = [
  // ── 1. Classic Blue (default) ──────────────────────────────────────────────
  {
    id: 'classic',
    name: 'Classic',
    description: 'The original blue brand palette',
    swatches: ['#0f1c2e', '#3582e2', '#e8f1fc'],
    vars: {
      ...DARK_CHROME,
      '--color-brand':          '#3582e2',
      '--color-brand-dark':     '#0f1c2e',
      '--color-brand-light':    '#e8f1fc',
      '--color-secondary':      '#3582e2',
      '--color-secondary-50':   '#e8f1fc',
      '--color-secondary-100':  '#d1e3f9',
      '--color-secondary-200':  '#a3c7f3',
      '--color-secondary-300':  '#75abed',
      '--color-secondary-400':  '#4790e7',
      '--color-secondary-500':  '#3582e2',
      '--color-secondary-600':  '#2a68b5',
      '--color-secondary-700':  '#1f4e88',
      '--color-secondary-800':  '#15345b',
      '--color-secondary-900':  '#0a1a2e',
      '--color-accent':         '#3582e2',
      '--color-accent-light':   '#e8f1fc',
      '--color-bg':             '#f0f4fa',
      '--gradient-brand':       'linear-gradient(135deg, #0a1a2e 0%, #1f4e88 60%, #3582e2 100%)',
      '--gradient-brand-blue':  'linear-gradient(135deg, #3582e2 0%, #1f4e88 100%)',
      '--shadow-sidebar':       '4px 0 20px rgba(15,28,46,0.25)',
      '--shadow-sidebar-mobile':'4px 0 20px rgba(15,28,46,0.35)',
    },
    sidebar: {
      bg:     '#0f1c2e',
      hover:  '#162438',
      active: '#1a2f4a',
      border: '#1c2d42',
      text:   '#a8bbd4',
      muted:  '#5d7898',
    },
  },

  // ── 2. Obsidian (Black & White) ────────────────────────────────────────────
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Pure black & white — no gradients',
    swatches: ['#111111', '#333333', '#f5f5f5'],
    vars: {
      ...DARK_CHROME,
      '--color-brand':          '#1a1a1a',
      '--color-brand-dark':     '#000000',
      '--color-brand-light':    '#f0f0f0',
      '--color-secondary':      '#1a1a1a',
      '--color-secondary-50':   '#f5f5f5',
      '--color-secondary-100':  '#ebebeb',
      '--color-secondary-200':  '#d6d6d6',
      '--color-secondary-300':  '#b8b8b8',
      '--color-secondary-400':  '#8a8a8a',
      '--color-secondary-500':  '#1a1a1a',
      '--color-secondary-600':  '#111111',
      '--color-secondary-700':  '#0a0a0a',
      '--color-secondary-800':  '#050505',
      '--color-secondary-900':  '#000000',
      '--color-accent':         '#1a1a1a',
      '--color-accent-light':   '#f0f0f0',
      '--color-bg':             '#f7f7f7',
      '--gradient-brand':       '#111111',
      '--gradient-brand-blue':  '#1a1a1a',
      '--shadow-sidebar':       '4px 0 20px rgba(0,0,0,0.30)',
      '--shadow-sidebar-mobile':'4px 0 20px rgba(0,0,0,0.40)',
    },
    sidebar: {
      bg:     '#111111',
      hover:  '#222222',
      active: '#333333',
      border: '#2a2a2a',
      text:   '#c0c0c0',
      muted:  '#6b6b6b',
    },
  },

  // ── 3. Emerald (Green) ─────────────────────────────────────────────────────
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'Fresh green tones for a vibrant feel',
    swatches: ['#064e3b', '#059669', '#d1fae5'],
    vars: {
      ...DARK_CHROME,
      '--color-brand':          '#059669',
      '--color-brand-dark':     '#064e3b',
      '--color-brand-light':    '#d1fae5',
      '--color-secondary':      '#059669',
      '--color-secondary-50':   '#ecfdf5',
      '--color-secondary-100':  '#d1fae5',
      '--color-secondary-200':  '#a7f3d0',
      '--color-secondary-300':  '#6ee7b7',
      '--color-secondary-400':  '#34d399',
      '--color-secondary-500':  '#059669',
      '--color-secondary-600':  '#047857',
      '--color-secondary-700':  '#065f46',
      '--color-secondary-800':  '#064e3b',
      '--color-secondary-900':  '#022c22',
      '--color-accent':         '#059669',
      '--color-accent-light':   '#d1fae5',
      '--color-bg':             '#f0faf5',
      '--gradient-brand':       'linear-gradient(135deg, #022c22 0%, #065f46 60%, #059669 100%)',
      '--gradient-brand-blue':  'linear-gradient(135deg, #059669 0%, #065f46 100%)',
      '--shadow-sidebar':       '4px 0 20px rgba(6,78,59,0.30)',
      '--shadow-sidebar-mobile':'4px 0 20px rgba(6,78,59,0.40)',
    },
    sidebar: {
      bg:     '#022c22',
      hover:  '#064e3b',
      active: '#065f46',
      border: '#0a5040',
      text:   '#a7d9c8',
      muted:  '#4d9e87',
    },
  },

  // ── 4. Graphite (Dark Slate) ───────────────────────────────────────────────
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Cool slate grey with indigo highlights',
    swatches: ['#1e293b', '#6366f1', '#e0e7ff'],
    vars: {
      ...DARK_CHROME,
      '--color-brand':          '#6366f1',
      '--color-brand-dark':     '#1e293b',
      '--color-brand-light':    '#e0e7ff',
      '--color-secondary':      '#6366f1',
      '--color-secondary-50':   '#eef2ff',
      '--color-secondary-100':  '#e0e7ff',
      '--color-secondary-200':  '#c7d2fe',
      '--color-secondary-300':  '#a5b4fc',
      '--color-secondary-400':  '#818cf8',
      '--color-secondary-500':  '#6366f1',
      '--color-secondary-600':  '#4f46e5',
      '--color-secondary-700':  '#4338ca',
      '--color-secondary-800':  '#3730a3',
      '--color-secondary-900':  '#312e81',
      '--color-accent':         '#6366f1',
      '--color-accent-light':   '#e0e7ff',
      '--color-bg':             '#f1f3f9',
      '--gradient-brand':       'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #6366f1 100%)',
      '--gradient-brand-blue':  'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
      '--shadow-sidebar':       '4px 0 20px rgba(15,23,42,0.30)',
      '--shadow-sidebar-mobile':'4px 0 20px rgba(15,23,42,0.40)',
    },
    sidebar: {
      bg:     '#0f172a',
      hover:  '#1e293b',
      active: '#293548',
      border: '#1e2d40',
      text:   '#94a3b8',
      muted:  '#4b6180',
    },
  },

  // ── 5. Blossom (Pink) ──────────────────────────────────────────────────────
  // The only light-chrome theme: #F8B2B2 paints the sidebar and the top-bar
  // gradients rather than the page background, which stays neutral so the pink
  // reads as chrome instead of a wash. #F8B2B2 is hsl(0, 83%, 83.5%) — far too
  // light for white text (1.75:1), so the chrome-* / on-brand-* vars flip the
  // banner and sidebar foregrounds to deep rose; index.css redirects the
  // markup's `text-white` utilities onto them. Buttons keep white-on-#c24a53.
  {
    id: 'pink',
    name: 'Pink',
    description: 'Blush #F8B2B2 navigation on a neutral canvas',
    swatches: ['#4a1a20', '#c24a53', '#f8b2b2'],
    vars: {
      // Light chrome — deep-rose foregrounds instead of DARK_CHROME's whites.
      '--chrome-fg':               '#6b262d', // brand name, user name  — deep rose
      '--chrome-fg-soft':          '#a93e48', // profile link           — medium rose
      '--chrome-danger-fg':        '#991829', // sign-out
      '--chrome-active-fg':        '#ffffff', // on the deep active pill
      '--chrome-overlay':          'rgba(194,74,83,0.12)',
      '--on-brand-fg':             '#6b262d', // banner title
      '--on-brand-fg-muted':       '#a93e48', // banner subtitle
      '--on-brand-overlay':        'rgba(194,74,83,0.12)',
      '--on-brand-overlay-border': 'rgba(194,74,83,0.20)',
      '--color-brand':          '#e8717a',
      '--color-brand-dark':     '#c24a53',
      '--color-brand-light':    '#fce8e9',
      '--color-secondary':      '#e8717a',
      '--color-secondary-50':   '#fef5f5',
      '--color-secondary-100':  '#fce8e9',
      '--color-secondary-200':  '#f9d2d3',
      '--color-secondary-300':  '#f8b2b2', // ← the requested colour
      '--color-secondary-400':  '#f09098',
      // 500 = primary action colour — bright coral-rose, not wine-dark.
      '--color-secondary-500':  '#e8717a',
      // 600 = hover on primary buttons — slightly deeper but still vivid rose.
      '--color-secondary-600':  '#d45a63',
      // 700 = group-hover text — warm rose, not dark red.
      '--color-secondary-700':  '#c24a53',
      // 800/900 kept deep for rare high-contrast needs (e.g. active pill text).
      '--color-secondary-800':  '#a93e48',
      '--color-secondary-900':  '#8a3139',
      '--color-accent':         '#e8717a',
      '--color-accent-light':   '#fce8e9',
      // Neutral canvas — the pink lives on the chrome, not behind the content.
      '--color-bg':             '#f6f7f9',
      // Top bars: a shallow gradient across the blush range.
      '--gradient-brand':       'linear-gradient(135deg, #f6a8a8 0%, #f8b2b2 55%, #fbc2c2 100%)',
      '--gradient-brand-blue':  'linear-gradient(135deg, #f8b2b2 0%, #f4a0a0 100%)',
      '--shadow-sidebar':       '4px 0 20px rgba(194,74,83,0.18)',
      '--shadow-sidebar-mobile':'4px 0 20px rgba(194,74,83,0.28)',
    },
    sidebar: {
      bg:     '#f8b2b2', // ← the requested blush
      hover:  '#fde8e8', // very light blush glow on hover — airy, not dark
      active: '#c24a53', // vivid rose active pill
      border: '#f0a0a0',
      text:   '#a93e48', // medium rose — readable yet pink
      muted:  '#c24a53', // rose sub-labels
    },
  },
];

export const getTheme = (id: string): AppTheme =>
  THEMES.find((t) => t.id === id) ?? THEMES[0];
