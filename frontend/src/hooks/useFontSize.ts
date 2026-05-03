import { useEffect, useCallback } from 'react';

export type FontSizeScale = 'sm' | 'md' | 'lg' | 'xl';

const HEADING_KEY = 'pos-heading-size';
const BODY_KEY    = 'pos-body-size';

/**
 * Font size presets for heading elements (h1, h2, h3, page titles, card titles).
 * Each preset maps Tailwind text-* classes to overridden pixel values.
 */
const HEADING_PRESETS: Record<FontSizeScale, Record<string, string>> = {
  sm: {
    'text-xs':   '10px', 'text-sm':  '11px', 'text-base': '12px',
    'text-lg':   '13px', 'text-xl':  '15px', 'text-2xl':  '18px',
    'text-3xl':  '20px', 'text-4xl': '24px',
  },
  md: {
    // Tailwind defaults — no override needed, but listed for reference
    'text-xs':   '12px', 'text-sm':  '14px', 'text-base': '16px',
    'text-lg':   '18px', 'text-xl':  '20px', 'text-2xl':  '24px',
    'text-3xl':  '30px', 'text-4xl': '36px',
  },
  lg: {
    'text-xs':   '13px', 'text-sm':  '15px', 'text-base': '17px',
    'text-lg':   '20px', 'text-xl':  '23px', 'text-2xl':  '28px',
    'text-3xl':  '36px', 'text-4xl': '42px',
  },
  xl: {
    'text-xs':   '14px', 'text-sm':  '16px', 'text-base': '18px',
    'text-lg':   '22px', 'text-xl':  '26px', 'text-2xl':  '32px',
    'text-3xl':  '40px', 'text-4xl': '48px',
  },
};

/**
 * Font size presets for body / paragraph text elements.
 * Applied selectively to elements tagged with data-body-text, and also to
 * common text utility classes when those classes appear on non-heading elements.
 */
const BODY_PRESETS: Record<FontSizeScale, Record<string, string>> = {
  sm: {
    'text-xs':   '9px',  'text-sm':  '11px', 'text-base': '12px',
    'text-lg':   '13px',
  },
  md: {
    'text-xs':   '12px', 'text-sm':  '14px', 'text-base': '16px',
    'text-lg':   '18px',
  },
  lg: {
    'text-xs':   '13px', 'text-sm':  '15px', 'text-base': '17px',
    'text-lg':   '20px',
  },
  xl: {
    'text-xs':   '14px', 'text-sm':  '17px', 'text-base': '19px',
    'text-lg':   '22px',
  },
};

/**
 * Build a CSS rule string that overrides Tailwind text-size class on
 * heading elements (h1–h4 and elements with role=heading or data-heading).
 */
function buildHeadingCSS(scale: FontSizeScale): string {
  const preset = HEADING_PRESETS[scale];
  if (scale === 'md') {
    // Default scale — remove any previous heading overrides
    return '/* heading-size: md (Tailwind default) */';
  }
  return Object.entries(preset)
    .map(([cls, px]) =>
      // Target heading elements using those classes
      `h1.${cls}, h2.${cls}, h3.${cls}, h4.${cls},
       [data-heading].${cls},
       .page-title.${cls},
       .text-xl.font-bold, .text-2xl.font-bold, .text-3xl.font-bold { }
       h1.${cls}, h2.${cls}, h3.${cls}, h4.${cls} { font-size: ${px} !important; }`
    )
    .join('\n');
}

/**
 * The approach: instead of targeting individual semantic elements (which would
 * require data attributes everywhere), we set a CSS custom property
 * --font-size-heading-scale and --font-size-body-scale on :root and use
 * those to drive CSS calc() multipliers for both the heading and body sizes.
 *
 * The style tag also overrides specific Tailwind font-size classes wholesale
 * so that ALL elements using those classes are affected — this is the most
 * reliable approach given Tailwind's build-time class generation.
 *
 * Heading sizes affect: text-xl, text-2xl, text-3xl, text-4xl
 * Body sizes affect:    text-xs, text-sm, text-base, text-lg
 */
function buildFontSizeCSS(headingScale: FontSizeScale, bodyScale: FontSizeScale): string {
  const h = HEADING_PRESETS[headingScale];
  const b = BODY_PRESETS[bodyScale];

  const headingRules = headingScale !== 'md' ? `
    /* ── Heading font sizes (${headingScale}) ── */
    .text-xl   { font-size: ${h['text-xl']}  !important; }
    .text-2xl  { font-size: ${h['text-2xl']} !important; }
    .text-3xl  { font-size: ${h['text-3xl']} !important; }
    .text-4xl  { font-size: ${h['text-4xl']} !important; }
  ` : '/* heading-size: md — Tailwind defaults */';

  const bodyRules = bodyScale !== 'md' ? `
    /* ── Body font sizes (${bodyScale}) ── */
    .text-xs   { font-size: ${b['text-xs']}   !important; }
    .text-sm   { font-size: ${b['text-sm']}   !important; }
    .text-base { font-size: ${b['text-base']} !important; }
    .text-lg   { font-size: ${b['text-lg']}   !important; }
  ` : '/* body-size: md — Tailwind defaults */';

  return `${headingRules}\n${bodyRules}`;
}

function applyFontSizes(headingScale: FontSizeScale, bodyScale: FontSizeScale): void {
  // Set CSS custom properties for any calc()-based uses
  const root = document.documentElement;
  const scaleMap: Record<FontSizeScale, number> = { sm: 0.875, md: 1, lg: 1.125, xl: 1.25 };
  root.style.setProperty('--font-heading-scale', String(scaleMap[headingScale]));
  root.style.setProperty('--font-body-scale',    String(scaleMap[bodyScale]));

  // Inject/update the override style tag
  let tag = document.getElementById('pos-font-overrides') as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'pos-font-overrides';
    document.head.appendChild(tag);
  }
  tag.textContent = buildFontSizeCSS(headingScale, bodyScale);
}

export function useFontSize() {
  const setFontSizes = useCallback((headingScale: FontSizeScale, bodyScale: FontSizeScale) => {
    localStorage.setItem(HEADING_KEY, headingScale);
    localStorage.setItem(BODY_KEY,    bodyScale);
    applyFontSizes(headingScale, bodyScale);
  }, []);

  // Apply persisted sizes on mount
  useEffect(() => {
    const h = (localStorage.getItem(HEADING_KEY) ?? 'md') as FontSizeScale;
    const b = (localStorage.getItem(BODY_KEY)    ?? 'md') as FontSizeScale;
    applyFontSizes(h, b);
  }, []);

  return { setFontSizes };
}

export function getStoredFontSizes(): { heading: FontSizeScale; body: FontSizeScale } {
  return {
    heading: (localStorage.getItem(HEADING_KEY) ?? 'md') as FontSizeScale,
    body:    (localStorage.getItem(BODY_KEY)    ?? 'md') as FontSizeScale,
  };
}
