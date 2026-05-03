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

export const THEMES: AppTheme[] = [
  // ── 1. Classic Blue (default) ──────────────────────────────────────────────
  {
    id: 'classic',
    name: 'Classic',
    description: 'The original blue brand palette',
    swatches: ['#0f1c2e', '#3582e2', '#e8f1fc'],
    vars: {
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
];

export const getTheme = (id: string): AppTheme =>
  THEMES.find((t) => t.id === id) ?? THEMES[0];
