import { useState, useEffect, useRef, useCallback, Fragment, type CSSProperties, type ReactNode } from 'react';
import { productService, Product } from '../services/productService';
import { storeService, StoreSettings, type LabelLayoutPatch } from '../services/storeService';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import PageBanner from '../components/ui/PageBanner';
import {
  TagIcon,
  PrinterIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PaintBrushIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// --- Paper size dimensions (mm -> pixels at 96 dpi) ---
const MM_TO_PX = 3.7795;

const PAPER_PRESETS: Record<string, { widthMM: number; heightMM: number; label: string }> = {
  '80mm':    { widthMM: 80,  heightMM: 297, label: '80mm Receipt' },
  '58mm':    { widthMM: 58,  heightMM: 297, label: '58mm Receipt' },
  'A4':      { widthMM: 210, heightMM: 297, label: 'A4' },
  'Letter':  { widthMM: 216, heightMM: 279, label: 'Letter' },
  'A5':      { widthMM: 148, heightMM: 210, label: 'A5' },
};

// Per-label constants (mm)
const LABEL_W_MM  = 60;
const LABEL_H_MM  = 40;
const GAP_MM      = 4;
const MARGIN_MM   = 8;

const WEIGHT_OPTIONS = [400, 500, 600, 700, 800, 900] as const;

type TextAlignLR = 'left' | 'center' | 'right';
type LbpRowAlign = 'between' | 'left' | 'center' | 'right';

export type LabelSectionId = 'header' | 'title' | 'lbp' | 'price' | 'barcode';

const DEFAULT_LABEL_SECTION_ORDER: LabelSectionId[] = ['header', 'title', 'lbp', 'price', 'barcode'];

const LABEL_SECTION_META: { id: LabelSectionId; label: string; short: string }[] = [
  { id: 'header',  label: 'Store name (top bar)', short: 'Store'    },
  { id: 'title',   label: 'Product name',          short: 'Product'  },
  { id: 'lbp',     label: 'LBP line',              short: 'LBP'      },
  { id: 'price',   label: 'Price band',             short: 'Price'    },
  { id: 'barcode', label: 'Barcode',                short: 'Barcode'  },
];

function normalizeSectionOrder(raw: unknown): LabelSectionId[] {
  const valid = new Set<LabelSectionId>(['header', 'title', 'lbp', 'price', 'barcode']);
  if (!Array.isArray(raw)) return [...DEFAULT_LABEL_SECTION_ORDER];
  const out: LabelSectionId[] = [];
  for (const x of raw) {
    if (typeof x === 'string' && valid.has(x as LabelSectionId) && !out.includes(x as LabelSectionId)) {
      out.push(x as LabelSectionId);
    }
  }
  for (const id of DEFAULT_LABEL_SECTION_ORDER) {
    if (!out.includes(id)) out.push(id);
  }
  return out.slice(0, 5);
}

/** Separator between stacked blocks; keeps the usual gap-free join between header and product name. */
function sectionNeedsTopBorder(
  prev: LabelSectionId | null,
  curr: LabelSectionId,
  index: number
): boolean {
  if (index === 0) return false;
  if (prev === 'header' && curr === 'title') return false;
  return true;
}

export interface LabelLayoutFormState {
  label_show_lbp: boolean;
  label_store_name_size: number;
  label_product_name_size: number;
  label_lbp_size: number;
  label_price_size: number;
  label_header_align: TextAlignLR;
  label_header_font_weight: number;
  label_title_align: TextAlignLR;
  label_title_font_weight: number;
  label_lbp_row_align: LbpRowAlign;
  label_lbp_prefix_size: number;
  label_lbp_prefix_weight: number;
  label_lbp_amount_weight: number;
  label_price_row_align: TextAlignLR;
  label_currency_size: number;
  label_currency_weight: number;
  label_price_amount_weight: number;
  label_show_barcode: boolean;
  label_barcode_height: number;
  label_barcode_text_size: number;
  label_header_pad_v: number;
  label_title_pad_v: number;
  label_lbp_pad_v: number;
  label_price_pad_v: number;
  label_barcode_pad_v: number;
  label_section_order: LabelSectionId[];
}

function mmToPx(mm: number) {
  return Math.round(mm * MM_TO_PX);
}

function getPaperDims(paperSize: string | undefined) {
  const key = Object.keys(PAPER_PRESETS).find(
    k => k.toLowerCase() === (paperSize || '').toLowerCase()
  ) || 'A4';
  return PAPER_PRESETS[key];
}

function calcGrid(paperWidthMM: number) {
  const usable = paperWidthMM - MARGIN_MM * 2;
  const cols   = Math.max(1, Math.floor((usable + GAP_MM) / (LABEL_W_MM + GAP_MM)));
  return cols;
}

function labelFontSize(v: number | null | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeTextAlign(v: string | null | undefined, fallback: TextAlignLR): TextAlignLR {
  if (v === 'left' || v === 'center' || v === 'right') return v;
  return fallback;
}

function normalizeLbpRowAlign(v: string | null | undefined): LbpRowAlign {
  if (v === 'between' || v === 'left' || v === 'center' || v === 'right') return v;
  return 'between';
}

function clampWeight(v: number | null | undefined, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const r = Math.round(n / 100) * 100;
  return Math.min(900, Math.max(100, r));
}

function flexJustify(align: TextAlignLR): NonNullable<CSSProperties['justifyContent']> {
  if (align === 'left') return 'flex-start';
  if (align === 'right') return 'flex-end';
  return 'center';
}

function lbpRowJustify(align: LbpRowAlign): NonNullable<CSSProperties['justifyContent']> {
  switch (align) {
    case 'between': return 'space-between';
    case 'left': return 'flex-start';
    case 'right': return 'flex-end';
    default: return 'center';
  }
}

function labelFormFromStore(s: StoreSettings): LabelLayoutFormState {
  return {
    label_show_lbp: s.label_show_lbp ?? true,
    label_store_name_size: labelFontSize(s.label_store_name_size, 5.5),
    label_product_name_size: labelFontSize(s.label_product_name_size, 15),
    label_lbp_size: labelFontSize(s.label_lbp_size, 14),
    label_price_size: labelFontSize(s.label_price_size, 30),
    label_header_align: normalizeTextAlign(s.label_header_align, 'center'),
    label_header_font_weight: clampWeight(s.label_header_font_weight, 700),
    label_title_align: normalizeTextAlign(s.label_title_align, 'center'),
    label_title_font_weight: clampWeight(s.label_title_font_weight, 800),
    label_lbp_row_align: normalizeLbpRowAlign(s.label_lbp_row_align),
    label_lbp_prefix_size: labelFontSize(s.label_lbp_prefix_size, 10),
    label_lbp_prefix_weight: clampWeight(s.label_lbp_prefix_weight, 700),
    label_lbp_amount_weight: clampWeight(s.label_lbp_amount_weight, 800),
    label_price_row_align: normalizeTextAlign(s.label_price_row_align, 'center'),
    label_currency_size: labelFontSize(s.label_currency_size, 11),
    label_currency_weight: clampWeight(s.label_currency_weight, 700),
    label_price_amount_weight: clampWeight(s.label_price_amount_weight, 900),
    label_show_barcode: s.label_show_barcode ?? true,
    label_barcode_height: labelFontSize(s.label_barcode_height, 22),
    label_barcode_text_size: labelFontSize(s.label_barcode_text_size, 7),
    label_header_pad_v: labelFontSize(s.label_header_pad_v, 2.5),
    label_title_pad_v: labelFontSize(s.label_title_pad_v, 4),
    label_lbp_pad_v: labelFontSize(s.label_lbp_pad_v, 2.5),
    label_price_pad_v: labelFontSize(s.label_price_pad_v, 4.5),
    label_barcode_pad_v: labelFontSize(s.label_barcode_pad_v, 3),
    label_section_order: normalizeSectionOrder(s.label_section_order),
  };
}

function mergeLabelFormIntoStore(base: StoreSettings, form: LabelLayoutFormState): StoreSettings {
  return { ...base, ...form };
}

function sectionRing(
  interactive: boolean | undefined,
  active: boolean,
  extra = ''
): string {
  if (!interactive) return extra;
  return [
    extra,
    'relative transition-[box-shadow,transform] duration-150 rounded-sm',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-1',
    active
      ? 'ring-2 ring-secondary-500 ring-offset-1 z-[1] shadow-md'
      : 'hover:ring-2 hover:ring-secondary-300/90 hover:ring-offset-0',
  ].filter(Boolean).join(' ');
}

// --- Code 128B barcode encoder ---
// Each entry = 6-char string of widths [bar,spc,bar,spc,bar,spc], sum = 11.
// Indices 0-102 = data; 103 = Start A; 104 = Start B; 105 = Start C.
const C128: readonly string[] = [
  '212222','222122','222221','121223','121322','131222','122213','122312',
  '132212','221213','221312','231212','112232','122132','122231','113222',
  '123122','123221','223211','221132','221231','213212','223112','312131',
  '311222','321122','321221','312212','322112','322211','212123','212321',
  '232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121',
  '313121','211331','231131','213113','213311','213131','311123','311321',
  '331121','312113','312311','332111','314111','221411','431111','111224',
  '111422','121124','121421','141122','141221','112214','112412','122114',
  '122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112',
  '421211','212141','214121','412121','111143','111341','131141','114113',
  '114311','411113','411311','113141','114131','311141','411131',
  '211412','211214','211232', // 103 Start A, 104 Start B, 105 Start C
];
const C128_STOP = '2331112'; // 7 elements, 13 modules

function code128b(text: string): boolean[] {
  if (!text) return [];
  const START_B = 104;
  let check = START_B;
  const codes: number[] = [START_B];
  for (let i = 0; i < text.length; i++) {
    const v = Math.max(0, Math.min(95, text.charCodeAt(i) - 32));
    codes.push(v);
    check += v * (i + 1);
  }
  codes.push(check % 103);
  const bits: boolean[] = [];
  const push = (pat: string) => {
    let bar = true;
    for (const ch of pat) {
      const w = parseInt(ch, 10);
      for (let k = 0; k < w; k++) bits.push(bar);
      bar = !bar;
    }
  };
  for (const code of codes) push(C128[code] ?? '111111');
  push(C128_STOP);
  return bits;
}

function BarcodeRenderer({ bits, barHeight }: { bits: boolean[]; barHeight: number }) {
  if (!bits.length) return null;
  const rects: { x: number; w: number }[] = [];
  for (let i = 0; i < bits.length; i++) {
    if (!bits[i]) continue;
    const last = rects[rects.length - 1];
    if (last && last.x + last.w === i) last.w++;
    else rects.push({ x: i, w: 1 });
  }
  return (
    <svg viewBox={`0 0 ${bits.length} ${barHeight}`} width="100%" height={barHeight}
      preserveAspectRatio="none" style={{ display: 'block' }} aria-hidden="true">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={0} width={r.w} height={barHeight} fill="#000000" />
      ))}
    </svg>
  );
}

// --- Label card (single label) ---
interface LabelCardProps {
  storeName: string;
  productName: string;
  price: number;
  currency: string;
  barcode?: string;
  /** When null, LBP line is omitted */
  store: StoreSettings | null;
  style?: React.CSSProperties;
  interactive?: boolean;
  activeSection?: LabelSectionId | null;
  onSectionSelect?: (section: LabelSectionId) => void;
}

function LabelCard({
  storeName,
  productName,
  price,
  currency,
  barcode,
  store,
  style,
  interactive,
  activeSection,
  onSectionSelect,
}: LabelCardProps) {
  const lbpRate    = store ? Number(store.lbp_exchange_rate ?? 0) : 0;
  const lbpEnabled = store?.label_show_lbp !== false; // toggle is on (default: true)
  const showLbp    = !!store && lbpRate > 0 && lbpEnabled;
  const lbpAmount  = showLbp ? Math.round(Number(price) * lbpRate) : 0;
  // Placeholder only when toggle is ON but no exchange rate is configured
  const editorLbpPlaceholder = !!interactive && !showLbp && lbpEnabled;

  const showBarcode    = !!store && (store.label_show_barcode !== false);
  const barcodeHeight  = labelFontSize(store?.label_barcode_height, 22);
  const barcodeTextSz  = labelFontSize(store?.label_barcode_text_size, 7);
  const barcodeBits    = showBarcode && barcode ? code128b(barcode) : [];
  const editorBarcodePh = !!interactive && (!barcode || !showBarcode);

  const tightLayout = showLbp || editorLbpPlaceholder || showBarcode || editorBarcodePh;

  const headerAlign = normalizeTextAlign(store?.label_header_align, 'center');
  const titleAlign = normalizeTextAlign(store?.label_title_align, 'center');
  const lbpRowAlign = normalizeLbpRowAlign(store?.label_lbp_row_align);
  const priceRowAlign = normalizeTextAlign(store?.label_price_row_align, 'center');

  const nameSize = labelFontSize(store?.label_store_name_size, 5.5);
  const titleSize = labelFontSize(store?.label_product_name_size, 15);
  const lbpNumSize = labelFontSize(store?.label_lbp_size, 14);
  const lbpPrefixSize = labelFontSize(store?.label_lbp_prefix_size, 10);
  const priceNumSize = labelFontSize(store?.label_price_size, 30);
  const currencySize = labelFontSize(store?.label_currency_size, 11);

  const headerW = clampWeight(store?.label_header_font_weight, 700);
  const titleW = clampWeight(store?.label_title_font_weight, 800);
  const lbpPrefixW = clampWeight(store?.label_lbp_prefix_weight, 700);
  const lbpAmtW = clampWeight(store?.label_lbp_amount_weight, 800);
  const currencyW = clampWeight(store?.label_currency_weight, 700);
  const priceAmtW = clampWeight(store?.label_price_amount_weight, 900);

  const headerPadV   = labelFontSize(store?.label_header_pad_v, 2.5);
  const titlePadV    = labelFontSize(store?.label_title_pad_v, 4);
  const lbpPadV      = labelFontSize(store?.label_lbp_pad_v, 2.5);
  const pricePadV    = labelFontSize(store?.label_price_pad_v, 4.5);
  const barcodePadV  = labelFontSize(store?.label_barcode_pad_v, 3);

  const pickLbp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSectionSelect?.('lbp');
  };

  const headerStyle: React.CSSProperties = {
    width: '100%',
    background: '#1a1a1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: flexJustify(headerAlign),
    padding: `${headerPadV}px 6px`,
    boxSizing: 'border-box',
    flexShrink: 0,
    border: 'none',
    cursor: interactive ? 'pointer' : undefined,
    font: 'inherit',
  };

  const titleBlockStyle: React.CSSProperties = {
    flex: 1,
    width: '100%',
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: flexJustify(titleAlign),
    padding: `${titlePadV}px 8px`,
    boxSizing: 'border-box',
    border: 'none',
    cursor: interactive ? 'pointer' : undefined,
    font: 'inherit',
  };

  const order = normalizeSectionOrder(store?.label_section_order);

  return (
    <div
      className={`label-card ${interactive ? 'select-none' : ''}`}
      style={{
        width:         mmToPx(LABEL_W_MM),
        height:        mmToPx(LABEL_H_MM),
        border:        '1.5px solid #1a1a1a',
        borderRadius:  5,
        display:       'flex',
        flexDirection: 'column',
        background:    '#ffffff',
        boxSizing:     'border-box',
        overflow:      'hidden',
        fontFamily:    'Georgia, "Times New Roman", serif',
        ...style,
      }}
    >
      {order.map((sectionId, index) => {
        const prev = index > 0 ? order[index - 1]! : null;
        const sep = sectionNeedsTopBorder(prev, sectionId, index);
        const sepSolid: React.CSSProperties = sep ? { borderTop: '1px solid #d0d0d0' } : {};
        const sepDash: React.CSSProperties = sep ? { borderTop: '1px dashed #c4c4c4' } : {};

        if (sectionId === 'header') {
          const hs: React.CSSProperties = { ...headerStyle, ...sepSolid };
          return interactive ? (
            <button
              key={`${index}-header`}
              type="button"
              aria-label="Edit store name bar"
              aria-pressed={activeSection === 'header'}
              onClick={(e) => {
                e.stopPropagation();
                onSectionSelect?.('header');
              }}
              className={sectionRing(true, activeSection === 'header')}
              style={hs}
            >
              <span style={{
                fontSize:      nameSize,
                fontWeight:    headerW,
                color:         '#ffffff',
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                whiteSpace:    'nowrap',
                overflow:      'hidden',
                textOverflow:  'ellipsis',
                display:       'block',
                fontFamily:    'Arial, Helvetica, sans-serif',
                pointerEvents: 'none',
              }}>
                {storeName}
              </span>
            </button>
          ) : (
            <div key={`${index}-header`} style={hs}>
              <span style={{
                fontSize:      nameSize,
                fontWeight:    headerW,
                color:         '#ffffff',
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                whiteSpace:    'nowrap',
                overflow:      'hidden',
                textOverflow:  'ellipsis',
                display:       'block',
                fontFamily:    'Arial, Helvetica, sans-serif',
              }}>
                {storeName}
              </span>
            </div>
          );
        }

        if (sectionId === 'title') {
          const ts: React.CSSProperties = { ...titleBlockStyle, ...sepSolid };
          return interactive ? (
            <button
              key={`${index}-title`}
              type="button"
              aria-label="Edit product name"
              aria-pressed={activeSection === 'title'}
              onClick={(e) => {
                e.stopPropagation();
                onSectionSelect?.('title');
              }}
              className={`${sectionRing(true, activeSection === 'title')} flex-1 min-h-0`}
              style={ts}
            >
              <span style={{
                fontSize:       titleSize,
                fontWeight:     titleW,
                color:          '#111111',
                textAlign:      titleAlign,
                lineHeight:     1.2,
                wordBreak:      'break-word',
                overflowWrap:   'break-word',
                display:        '-webkit-box',
                WebkitLineClamp: tightLayout ? 2 : 3,
                WebkitBoxOrient: 'vertical',
                overflow:       'hidden',
                fontFamily:     'Arial, Helvetica, sans-serif',
                letterSpacing:  '0.005em',
                width:          titleAlign === 'center' ? '100%' : 'auto',
                maxWidth:       '100%',
                pointerEvents:  'none',
              }}>
                {productName}
              </span>
            </button>
          ) : (
            <div key={`${index}-title`} style={ts}>
              <span style={{
                fontSize:       titleSize,
                fontWeight:     titleW,
                color:          '#111111',
                textAlign:      titleAlign,
                lineHeight:     1.2,
                wordBreak:      'break-word',
                overflowWrap:   'break-word',
                display:        '-webkit-box',
                WebkitLineClamp: showLbp ? 2 : 3,
                WebkitBoxOrient: 'vertical',
                overflow:       'hidden',
                fontFamily:     'Arial, Helvetica, sans-serif',
                letterSpacing:  '0.005em',
                width:          titleAlign === 'center' ? '100%' : 'auto',
                maxWidth:       '100%',
              }}>
                {productName}
              </span>
            </div>
          );
        }

        if (sectionId === 'lbp') {
          if (!lbpEnabled) {
            return <Fragment key={`${index}-lbp-skip`} />;
          }
          if (!showLbp && !interactive) {
            return <Fragment key={`${index}-lbp-skip`} />;
          }
          if (!showLbp && interactive) {
            return (
              <button
                key={`${index}-lbp-ph`}
                type="button"
                aria-label="Edit LBP line settings"
                aria-pressed={activeSection === 'lbp'}
                onClick={pickLbp}
                className={sectionRing(true, activeSection === 'lbp')}
                style={{
                  width: '100%',
                  flexShrink: 0,
                  ...sepDash,
                  background: '#fafafa',
                  padding: '6px 8px',
                  boxSizing: 'border-box',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 600, color: '#888', textAlign: 'center', display: 'block', fontFamily: 'Arial, sans-serif', pointerEvents: 'none' }}>
                  LBP line — set exchange rate in Admin to preview
                </span>
              </button>
            );
          }
          return interactive ? (
            <button
              key={`${index}-lbp`}
              type="button"
              aria-label="Edit LBP line"
              aria-pressed={activeSection === 'lbp'}
              onClick={pickLbp}
              className={sectionRing(true, activeSection === 'lbp')}
              style={{
                width: '100%',
                flexShrink: 0,
                ...sepSolid,
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: lbpRowJustify(lbpRowAlign),
                padding: `${lbpPadV}px 8px`,
                boxSizing: 'border-box',
                gap: lbpRowAlign === 'center' ? 8 : 6,
                border: 'none',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              <span style={{ fontSize: lbpPrefixSize, fontWeight: lbpPrefixW, color: '#333333', fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '0.04em', flexShrink: 0, pointerEvents: 'none' }}>LBP</span>
              <span style={{ fontSize: lbpNumSize, fontWeight: lbpAmtW, color: '#111111', fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '-0.02em', lineHeight: 1, textAlign: lbpRowAlign === 'between' ? 'right' : titleAlign, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>{lbpAmount.toLocaleString()}</span>
            </button>
          ) : (
            <div
              key={`${index}-lbp`}
              style={{
                width: '100%', flexShrink: 0, ...sepSolid, background: '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: lbpRowJustify(lbpRowAlign),
                padding: `${lbpPadV}px 8px`, boxSizing: 'border-box', gap: lbpRowAlign === 'center' ? 8 : 6,
              }}
            >
              <span style={{ fontSize: lbpPrefixSize, fontWeight: lbpPrefixW, color: '#333333', fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '0.04em', flexShrink: 0 }}>LBP</span>
              <span style={{ fontSize: lbpNumSize, fontWeight: lbpAmtW, color: '#111111', fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '-0.02em', lineHeight: 1, textAlign: lbpRowAlign === 'between' ? 'right' : titleAlign, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{lbpAmount.toLocaleString()}</span>
            </div>
          );
        }

        if (sectionId === 'price') {
          return interactive ? (
            <button
              key={`${index}-price`}
              type="button"
              aria-label="Edit price band"
              aria-pressed={activeSection === 'price'}
              onClick={(e) => {
                e.stopPropagation();
                onSectionSelect?.('price');
              }}
              className={sectionRing(true, activeSection === 'price')}
              style={{
                width: '100%',
                background: '#f4f4f4',
                ...sepSolid,
                display: 'flex',
                alignItems: 'center',
                justifyContent: flexJustify(priceRowAlign),
                padding: `${pricePadV}px 6px`,
                boxSizing: 'border-box',
                flexShrink: 0,
                gap: 3,
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              <span style={{ fontSize: currencySize, fontWeight: currencyW, color: '#444444', fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '0.02em', pointerEvents: 'none' }}>{currency}</span>
              <span style={{ fontSize: priceNumSize, fontWeight: priceAmtW, color: '#111111', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'Arial Black, Arial, Helvetica, sans-serif', pointerEvents: 'none' }}>{Number(price).toFixed(2)}</span>
            </button>
          ) : (
            <div
              key={`${index}-price`}
              style={{
                width: '100%', background: '#f4f4f4', ...sepSolid, display: 'flex', alignItems: 'center',
                justifyContent: flexJustify(priceRowAlign), padding: `${pricePadV}px 6px`, boxSizing: 'border-box', flexShrink: 0, gap: 3,
              }}
            >
              <span style={{ fontSize: currencySize, fontWeight: currencyW, color: '#444444', fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '0.02em' }}>{currency}</span>
              <span style={{ fontSize: priceNumSize, fontWeight: priceAmtW, color: '#111111', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'Arial Black, Arial, Helvetica, sans-serif' }}>{Number(price).toFixed(2)}</span>
            </div>
          );
        }

        if (sectionId === 'barcode') {
          const barcodeBase: React.CSSProperties = {
            width: '100%', flexShrink: 0, boxSizing: 'border-box',
            padding: `${barcodePadV}px 6px`, ...sepSolid,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
          };

          if (!showBarcode && !interactive) {
            return <Fragment key={`${index}-barcode-skip`} />;
          }

          if (editorBarcodePh) {
            return (
              <button
                key={`${index}-barcode-ph`}
                type="button"
                aria-label="Edit barcode settings"
                aria-pressed={activeSection === 'barcode'}
                onClick={(e) => { e.stopPropagation(); onSectionSelect?.('barcode'); }}
                className={sectionRing(true, activeSection === 'barcode')}
                style={{ ...barcodeBase, background: '#fafafa', border: 'none', cursor: 'pointer', font: 'inherit', borderTop: sep ? '1px dashed #c4c4c4' : undefined }}
              >
                <span style={{ fontSize: 9, fontWeight: 600, color: '#aaa', fontFamily: 'Arial, sans-serif' }}>
                  {!showBarcode ? 'Barcode hidden' : 'No barcode — assign one to this product'}
                </span>
              </button>
            );
          }

          const bcContent = (
            <>
              <BarcodeRenderer bits={barcodeBits} barHeight={barcodeHeight} />
              <span style={{
                fontSize: barcodeTextSz, fontFamily: 'monospace', color: '#111111',
                letterSpacing: '0.06em', lineHeight: 1, textAlign: 'center',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: '100%', display: 'block',
              }}>
                {barcode}
              </span>
            </>
          );

          return interactive ? (
            <button
              key={`${index}-barcode`}
              type="button"
              aria-label="Edit barcode"
              aria-pressed={activeSection === 'barcode'}
              onClick={(e) => { e.stopPropagation(); onSectionSelect?.('barcode'); }}
              className={sectionRing(true, activeSection === 'barcode')}
              style={{ ...barcodeBase, background: '#fff', border: 'none', cursor: 'pointer', font: 'inherit' }}
            >
              {bcContent}
            </button>
          ) : (
            <div key={`${index}-barcode`} style={{ ...barcodeBase, background: '#fff' }}>
              {bcContent}
            </div>
          );
        }

        return <Fragment key={`${index}-unknown`} />;
      })}
    </div>
  );
}


// --- Promotion Card (A4 Poster) ---
interface PromotionCardProps {
  storeName: string;
  productName: string;
  price: number;
  unit: string;
  origin?: string;
  promoText: string;
  style?: React.CSSProperties;
}

function starPolygon(cx: number, cy: number, outerR: number, innerR: number, pts: number): string {
  const step = (2 * Math.PI) / pts;
  return Array.from({ length: pts }, (_, i) => {
    const a1 = i * step - Math.PI / 2;
    const a2 = a1 + step / 2;
    return [
      `${(cx + outerR * Math.cos(a1)).toFixed(2)},${(cy + outerR * Math.sin(a1)).toFixed(2)}`,
      `${(cx + innerR * Math.cos(a2)).toFixed(2)},${(cy + innerR * Math.sin(a2)).toFixed(2)}`,
    ].join(' ');
  }).join(' ');
}

function PromotionCard({
  storeName,
  productName,
  price,
  unit,
  origin,
  promoText,
  style,
}: PromotionCardProps) {
  const priceString = Number(price).toFixed(2);
  const [dollars, cents] = priceString.split('.');

  const words = promoText.trim().split(/\s+/).filter(Boolean);
  const half = Math.ceil(words.length / 2);
  const badgeLine1 = words.slice(0, half).join(' ');
  const badgeLine2 = words.slice(half).join(' ');

  const GREEN = '#1B5E2F';
  const RED   = '#D0001B';

  return (
    <div
      className="promotion-poster"
      style={{
        width: '210mm',
        height: '297mm',
        backgroundColor: '#F8F8F6',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        WebkitPrintColorAdjust: 'exact' as React.CSSProperties['WebkitPrintColorAdjust'],
        ...style,
      }}
    >
      {/* Subtle dot texture — depth without noise */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.045) 1.2px, transparent 1.2px)',
        backgroundSize: '20px 20px',
      }} />

      {/* ── Content ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        padding: '16mm 16mm 14mm',
        boxSizing: 'border-box',
      }}>

        {/* HEADER — store name */}
        <div style={{ textAlign: 'center', marginBottom: '11mm', flexShrink: 0 }}>
          <p style={{
            fontSize: '14pt',
            fontWeight: 700,
            color: '#3C3C3C',
            letterSpacing: '0.38em',
            textTransform: 'uppercase',
            margin: 0,
          }}>
            {storeName}
          </p>
          <div style={{
            width: '15mm', height: '1px',
            backgroundColor: '#3C3C3C', opacity: 0.5,
            margin: '3mm auto 0',
          }} />
        </div>

        {/* PRODUCT TITLE & ORIGIN */}
        <div style={{ textAlign: 'center', width: '100%', marginBottom: '9mm', flexShrink: 0 }}>
          <h1 style={{
            fontSize: '60pt',
            fontWeight: 800,
            color: GREEN,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            margin: 0,
            textTransform: 'uppercase',
          }}>
            {productName}
          </h1>
          {origin && (
            <p style={{
              fontSize: '20pt',
              fontWeight: 600,
              color: '#555555',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              margin: '3mm 0 0 0',
            }}>
              {origin}
            </p>
          )}
        </div>

        {/* PRICE — dominant red, hero of the poster */}
        <div style={{
          flex: 1,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          width: '100%',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', lineHeight: 1 }}>
            <span style={{
              fontSize: '60pt',
              fontWeight: 800,
              color: RED,
              lineHeight: 1,
              marginTop: '15mm',
              marginRight: '2mm',
            }}>$</span>

            <span style={{
              fontSize: '200pt',
              fontWeight: 800,
              color: RED,
              lineHeight: 0.85,
              letterSpacing: '-0.04em',
            }}>
              {dollars}
            </span>

            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'flex-start',
              paddingTop: '6mm', paddingLeft: '3mm',
              gap: '4mm',
            }}>
              <span style={{
                fontSize: '80pt',
                fontWeight: 800,
                color: RED,
                lineHeight: 1,
                textDecoration: 'underline',
                textDecorationThickness: '5px',
                textUnderlineOffset: '8px',
              }}>
                {cents}
              </span>
              <span style={{
                fontSize: '14pt',
                fontWeight: 700,
                color: '#666666',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}>
                / {unit}
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW — starburst badge left */}
        <div style={{
          width: '100%',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          flexShrink: 0, minHeight: '60mm',
        }}>

          {/* Starburst badge — lower left, massive size */}
          <div style={{ width: '90mm', height: '90mm', flexShrink: 0, filter: 'drop-shadow(4px 4px 8px rgba(0,0,0,0.15))', position: 'relative' }}>
            <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
              <polygon points={starPolygon(50, 50, 48, 32, 12)} fill={RED} stroke="#F8F8F6" strokeWidth="1.5" />
            </svg>
            {/* HTML Overlay for perfect centering and wrapping */}
            <div style={{
              position: 'absolute', 
              inset: '15%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              textAlign: 'center',
            }}>
              <span style={{
                color: 'white',
                fontWeight: 900,
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: '24pt',
                lineHeight: 1.1,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                textWrap: 'balance',
              }}>
                {promoText}
              </span>
            </div>
          </div>

          {/* Supporting text — lower right */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingBottom: '5mm' }}>
             {/* We removed origin from here since it's under the title now */}
          </div>

        </div>
      </div>
    </div>
  );
}

// --- Promotion Print Preview ---
function PromotionPrintPreview({ products, store, promoText, origin }: { products: Product[]; store: StoreSettings; promoText: string; origin: string }) {
  return (
    <div id="labels-print-root" className="bg-gray-200 flex flex-col gap-8">
      {products.map((p) => (
        <div key={p.product_id} className="bg-white shadow-xl mx-auto" style={{ width: '210mm', height: '297mm', pageBreakAfter: 'always' }}>
          <PromotionCard
            storeName={store.name}
            productName={p.name}
            price={p.sale_price ?? p.list_price ?? 0}
            unit={p.unit_of_measure || 'kilo'}
            origin={origin}
            promoText={promoText}
          />
        </div>
      ))}
    </div>
  );
}

// --- Print layout ---
interface PrintPreviewProps {
  products: Product[];
  store: StoreSettings;
}

function PrintPreview({ products, store }: PrintPreviewProps) {
  const paper  = getPaperDims(store.paper_size);
  const cols   = calcGrid(paper.widthMM);
  const currency = store.currency_code || 'USD';
  const storeName = store.name;

  const pageWidthPx  = mmToPx(paper.widthMM);
  const marginPx     = mmToPx(MARGIN_MM);
  const gapPx        = mmToPx(GAP_MM);
  const labelWPx     = mmToPx(LABEL_W_MM);
  const labelHPx     = mmToPx(LABEL_H_MM);

  const rows: Product[][] = [];
  for (let i = 0; i < products.length; i += cols) rows.push(products.slice(i, i + cols));

  return (
    <div
      id="labels-print-root"
      style={{
        width:      pageWidthPx,
        background: '#fff',
        padding:    marginPx,
        boxSizing:  'border-box',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {rows.map((row, ri) => (
        <div
          key={ri}
          style={{
            display: 'flex',
            gap:     gapPx,
            marginBottom: ri < rows.length - 1 ? gapPx : 0,
          }}
        >
          {row.map(p => (
            <LabelCard
              key={p.product_id}
              storeName={storeName}
              productName={p.name}
              price={p.sale_price ?? p.list_price ?? 0}
              currency={currency}
              barcode={p.barcode}
              store={store}
              style={{ width: labelWPx, height: labelHPx, flexShrink: 0 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

type SetLabelField = <K extends keyof LabelLayoutFormState>(key: K, value: LabelLayoutFormState[K]) => void;

// --- Reusable premium control sub-components ---

function AlignSegment({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid p-1 bg-gray-100 rounded-xl" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
            value === o.value
              ? 'bg-white text-secondary-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SizeSlider({ value, min, max, step = 0.5, onChange, fallback }: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; fallback: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400 font-mono">{min}px</span>
        <span className="text-xs font-bold text-secondary-700 tabular-nums bg-secondary-50 px-2 py-0.5 rounded-md border border-secondary-100">
          {value}px
        </span>
        <span className="text-[10px] text-gray-400 font-mono">{max}px</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || fallback)}
        className="w-full h-1.5 appearance-none bg-gray-200 rounded-full outline-none cursor-pointer"
        style={{ accentColor: '#3582e2' }}
      />
    </div>
  );
}

function WeightGrid({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl">
      {WEIGHT_OPTIONS.map(w => (
        <button
          key={w}
          type="button"
          onClick={() => onChange(w)}
          className={`py-1.5 rounded-lg text-xs transition-all ${
            value === w
              ? 'bg-white text-secondary-700 shadow-sm font-black'
              : 'text-gray-500 hover:text-gray-700 font-semibold'
          }`}
          style={{ fontWeight: w }}
        >
          {w}
        </button>
      ))}
    </div>
  );
}

function ControlRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );
}

function LabelSectionFormFields({
  section,
  layoutForm,
  setField,
}: {
  section: LabelSectionId;
  layoutForm: LabelLayoutFormState;
  setField: SetLabelField;
}) {
  const meta = LABEL_SECTION_META.find(m => m.id === section);
  const alignOpts = [
    { value: 'left',   label: 'Left'   },
    { id: 'center',  label: 'Center' },
    { value: 'right',  label: 'Right'  },
  ];

  const renderContent = () => {
    switch (section) {
      case 'header':
        return (
          <div className="space-y-4">
            <ControlRow label="Alignment">
              <AlignSegment
                value={layoutForm.label_header_align}
                onChange={v => setField('label_header_align', v as TextAlignLR)}
                options={[
                  { value: 'left',   label: 'Left'   },
                  { value: 'center', label: 'Center' },
                  { value: 'right',  label: 'Right'  },
                ]}
              />
            </ControlRow>
            <ControlRow label="Font size">
              <SizeSlider value={layoutForm.label_store_name_size} min={3} max={18} fallback={5.5}
                onChange={v => setField('label_store_name_size', v)} />
            </ControlRow>
            <ControlRow label="Font weight">
              <WeightGrid value={layoutForm.label_header_font_weight}
                onChange={v => setField('label_header_font_weight', v)} />
            </ControlRow>
            <ControlRow label="Section height">
              <SizeSlider value={layoutForm.label_header_pad_v} min={0} max={12} step={0.5} fallback={2.5}
                onChange={v => setField('label_header_pad_v', v)} />
            </ControlRow>
          </div>
        );

      case 'title':
        return (
          <div className="space-y-4">
            <ControlRow label="Alignment">
              <AlignSegment
                value={layoutForm.label_title_align}
                onChange={v => setField('label_title_align', v as TextAlignLR)}
                options={[
                  { value: 'left',   label: 'Left'   },
                  { value: 'center', label: 'Center' },
                  { value: 'right',  label: 'Right'  },
                ]}
              />
            </ControlRow>
            <ControlRow label="Font size">
              <SizeSlider value={layoutForm.label_product_name_size} min={6} max={36} fallback={15}
                onChange={v => setField('label_product_name_size', v)} />
            </ControlRow>
            <ControlRow label="Font weight">
              <WeightGrid value={layoutForm.label_title_font_weight}
                onChange={v => setField('label_title_font_weight', v)} />
            </ControlRow>
            <ControlRow label="Section height">
              <SizeSlider value={layoutForm.label_title_pad_v} min={0} max={20} step={0.5} fallback={4}
                onChange={v => setField('label_title_pad_v', v)} />
            </ControlRow>
          </div>
        );

      case 'lbp':
        return (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setField('label_show_lbp', !layoutForm.label_show_lbp)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                layoutForm.label_show_lbp
                  ? 'bg-secondary-50 border-secondary-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <span className="text-xs font-semibold text-gray-700">Show LBP line</span>
              <div className={`w-9 h-5 rounded-full transition-colors relative ${layoutForm.label_show_lbp ? 'bg-secondary-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${layoutForm.label_show_lbp ? 'left-[18px]' : 'left-0.5'}`} />
              </div>
            </button>

            <ControlRow label="Row layout">
              <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
                {([
                  { value: 'between', label: 'Spread' },
                  { value: 'left',    label: 'Left'   },
                  { value: 'center',  label: 'Center' },
                  { value: 'right',   label: 'Right'  },
                ] as { value: LbpRowAlign; label: string }[]).map(o => (
                  <button key={o.value} type="button"
                    onClick={() => setField('label_lbp_row_align', o.value)}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      layoutForm.label_lbp_row_align === o.value
                        ? 'bg-white text-secondary-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </ControlRow>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Prefix "LBP"</p>
              <ControlRow label="Size">
                <SizeSlider value={layoutForm.label_lbp_prefix_size} min={4} max={20} fallback={10}
                  onChange={v => setField('label_lbp_prefix_size', v)} />
              </ControlRow>
              <ControlRow label="Weight">
                <WeightGrid value={layoutForm.label_lbp_prefix_weight}
                  onChange={v => setField('label_lbp_prefix_weight', v)} />
              </ControlRow>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">LBP amount</p>
              <ControlRow label="Size">
                <SizeSlider value={layoutForm.label_lbp_size} min={6} max={36} fallback={14}
                  onChange={v => setField('label_lbp_size', v)} />
              </ControlRow>
              <ControlRow label="Weight">
                <WeightGrid value={layoutForm.label_lbp_amount_weight}
                  onChange={v => setField('label_lbp_amount_weight', v)} />
              </ControlRow>
            </div>
            <ControlRow label="Section height">
              <SizeSlider value={layoutForm.label_lbp_pad_v} min={0} max={12} step={0.5} fallback={2.5}
                onChange={v => setField('label_lbp_pad_v', v)} />
            </ControlRow>
          </div>
        );

      case 'price':
        return (
          <div className="space-y-4">
            <ControlRow label="Alignment">
              <AlignSegment
                value={layoutForm.label_price_row_align}
                onChange={v => setField('label_price_row_align', v as TextAlignLR)}
                options={[
                  { value: 'left',   label: 'Left'   },
                  { value: 'center', label: 'Center' },
                  { value: 'right',  label: 'Right'  },
                ]}
              />
            </ControlRow>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Currency code</p>
              <ControlRow label="Size">
                <SizeSlider value={layoutForm.label_currency_size} min={4} max={24} fallback={11}
                  onChange={v => setField('label_currency_size', v)} />
              </ControlRow>
              <ControlRow label="Weight">
                <WeightGrid value={layoutForm.label_currency_weight}
                  onChange={v => setField('label_currency_weight', v)} />
              </ControlRow>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Price amount</p>
              <ControlRow label="Size">
                <SizeSlider value={layoutForm.label_price_size} min={8} max={52} fallback={30}
                  onChange={v => setField('label_price_size', v)} />
              </ControlRow>
              <ControlRow label="Weight">
                <WeightGrid value={layoutForm.label_price_amount_weight}
                  onChange={v => setField('label_price_amount_weight', v)} />
              </ControlRow>
            </div>

            <ControlRow label="Section height">
              <SizeSlider value={layoutForm.label_price_pad_v} min={0} max={16} step={0.5} fallback={4.5}
                onChange={v => setField('label_price_pad_v', v)} />
            </ControlRow>
          </div>
        );

      case 'barcode':
        return (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setField('label_show_barcode', !layoutForm.label_show_barcode)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                layoutForm.label_show_barcode
                  ? 'bg-secondary-50 border-secondary-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <span className="text-xs font-semibold text-gray-700">Show barcode</span>
              <div className={`w-9 h-5 rounded-full transition-colors relative ${layoutForm.label_show_barcode ? 'bg-secondary-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${layoutForm.label_show_barcode ? 'left-[18px]' : 'left-0.5'}`} />
              </div>
            </button>

            <ControlRow label="Bar height">
              <SizeSlider value={layoutForm.label_barcode_height} min={10} max={36} step={1} fallback={22}
                onChange={v => setField('label_barcode_height', v)} />
            </ControlRow>

            <ControlRow label="Number text size">
              <SizeSlider value={layoutForm.label_barcode_text_size} min={4} max={14} step={0.5} fallback={7}
                onChange={v => setField('label_barcode_text_size', v)} />
            </ControlRow>

            <ControlRow label="Section height">
              <SizeSlider value={layoutForm.label_barcode_pad_v} min={0} max={12} step={0.5} fallback={3}
                onChange={v => setField('label_barcode_pad_v', v)} />
            </ControlRow>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-secondary-50 flex items-center justify-center">
          <PaintBrushIcon className="w-5 h-5 text-secondary-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">{meta?.label || 'Select a section'}</h3>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mt-0.5">Customizing {section} properties</p>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}

// --- Main Labels page ---
export default function Labels() {
  const { user } = useAuthStore();
  const canEditLayout = user?.role === 'admin' || user?.role === 'manager';

  const PAGE_SIZE = 50;

  const [products,              setProducts]              = useState<Product[]>([]);
  const [store,                 setStore]                 = useState<StoreSettings | null>(null);
  const [layoutForm,            setLayoutForm]            = useState<LabelLayoutFormState | null>(null);
  const [layoutOpen,            setLayoutOpen]            = useState(false);
  const [activeLabelSection,    setActiveLabelSection]    = useState<LabelSectionId | null>(null);
  const [savingLayout,          setSavingLayout]          = useState(false);
  const [loading,               setLoading]               = useState(true);
  const [search,                setSearch]                = useState('');
  const [searchQuery,           setSearchQuery]           = useState('');
  const [selected,              setSelected]              = useState<Set<string>>(new Set());
  const [selectedProductDetails, setSelectedProductDetails] = useState<Map<string, Product>>(new Map());
  const [currentPage,           setCurrentPage]           = useState(1);
  const [totalPages,            setTotalPages]            = useState(1);
  const [totalProducts,         setTotalProducts]         = useState(0);
  const [showPreview,           setShowPreview]           = useState(false);
  const [activeTab,             setActiveTab]             = useState<'shelf' | 'promotion'>('shelf');
  const [promoText,             setPromoText]             = useState('WEEKEND FRENZY!');
  const [promoOrigin,           setPromoOrigin]           = useState('PRODUCT OF AUSTRALIA');
  const [carouselOffset,        setCarouselOffset]        = useState(0);
  const printRef        = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load store settings once on mount
  useEffect(() => {
    let active = true;
    storeService.getDefaultStore().then(storeData => {
      if (!active) return;
      setStore(storeData);
      setLayoutForm(labelFormFromStore(storeData));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  // Reload products whenever the page number or search query changes
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const prodData = await productService.getProducts(
          { page: currentPage, limit: PAGE_SIZE, search: searchQuery || undefined },
          controller.signal
        );
        if (!active) return;
        setProducts(prodData.data);
        setTotalPages(prodData.pagination.totalPages);
        setTotalProducts(prodData.pagination.total);
      } catch (e: unknown) {
        const err = e as { name?: string; code?: string };
        if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [currentPage, searchQuery]);

  useEffect(() => { setCarouselOffset(0); }, [selected]);

  const displayStore =
    store && layoutForm ? mergeLabelFormIntoStore(store, layoutForm) : store;

  const saveLayout = useCallback(async () => {
    if (!store || !layoutForm) return;
    setSavingLayout(true);
    try {
      const payload: LabelLayoutPatch = { ...layoutForm };
      const updated = await storeService.patchLabelLayout(store.store_id, payload);
      setStore(updated);
      setLayoutForm(labelFormFromStore(updated));
      toast.success('Label appearance saved');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
        : null;
      toast.error(msg || 'Could not save label settings');
    } finally {
      setSavingLayout(false);
    }
  }, [store, layoutForm]);

  const resetLayout = useCallback(() => {
    if (store) setLayoutForm(labelFormFromStore(store));
  }, [store]);

  const setField = useCallback(<K extends keyof LabelLayoutFormState>(key: K, value: LabelLayoutFormState[K]) => {
    setLayoutForm(prev => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const moveSectionInOrder = useCallback((index: number, delta: number) => {
    setLayoutForm(prev => {
      if (!prev) return prev;
      const j = index + delta;
      if (j < 0 || j >= prev.label_section_order.length) return prev;
      const next = [...prev.label_section_order];
      const a = next[index]!;
      const b = next[j]!;
      next[index] = b;
      next[j] = a;
      return { ...prev, label_section_order: next };
    });
  }, []);

  // Debounce the search input: update the query after 400 ms of no typing, reset to page 1
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(value);
      setCurrentPage(1);
    }, 400);
  }, []);

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setSelectedProductDetails(prev => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        const product = products.find(p => p.product_id === id);
        if (product) next.set(id, product);
      }
      return next;
    });
  }, [products]);

  const allOnPageSelected = products.length > 0 && products.every(p => selected.has(p.product_id));

  const toggleAll = useCallback(() => {
    if (allOnPageSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        products.forEach(p => next.delete(p.product_id));
        return next;
      });
      setSelectedProductDetails(prev => {
        const next = new Map(prev);
        products.forEach(p => next.delete(p.product_id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        products.forEach(p => next.add(p.product_id));
        return next;
      });
      setSelectedProductDetails(prev => {
        const next = new Map(prev);
        products.forEach(p => next.set(p.product_id, p));
        return next;
      });
    }
  }, [products, allOnPageSelected]);

  const selectedProducts = Array.from(selectedProductDetails.values());

  // Page-number list for the pagination bar
  const pageNumbers: (number | '...')[] = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(2, currentPage - 2);
    const end   = Math.min(totalPages - 1, currentPage + 2);
    const nums: (number | '...')[] = [1];
    if (start > 2) nums.push('...');
    for (let i = start; i <= end; i++) nums.push(i);
    if (end < totalPages - 1) nums.push('...');
    nums.push(totalPages);
    return nums;
  })();

  const handlePrint = useCallback(() => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const win  = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Please allow pop-ups to print.'); return; }
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Labels</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #fff; }
            @media print {
              html, body { width: 100%; height: 100%; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
              @page { margin: 0; }
            }
          </style>
        </head>
        <body>\${html}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    const printWhenReady = () => { setTimeout(() => { win.print(); win.close(); }, 120); };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((win.document as any).fonts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (win.document as any).fonts.ready.then(printWhenReady);
    } else {
      setTimeout(printWhenReady, 900);
    }
  }, []);

  const paper    = store ? getPaperDims(store.paper_size) : PAPER_PRESETS['A4'];
  const cols     = calcGrid(paper.widthMM);
  const currency = store?.currency_code || 'USD';

  const previewStore = displayStore;

  const editorProductName =
    selectedProducts[0]?.name ?? products[0]?.name ?? 'Product name';
  const editorPrice = Number(
    selectedProducts[0]?.sale_price ??
      selectedProducts[0]?.list_price ??
      products[0]?.sale_price ??
      products[0]?.list_price ??
      9.99
  );
  const editorBarcode =
    selectedProducts[0]?.barcode ?? products[0]?.barcode ?? '1234567890';

  const CAROUSEL_VISIBLE  = 4;
  const CAROUSEL_SCALE    = 0.85;
  const scaledLabelW      = Math.round(mmToPx(LABEL_W_MM) * CAROUSEL_SCALE);
  const scaledLabelH      = Math.round(mmToPx(LABEL_H_MM) * CAROUSEL_SCALE);
  const visibleCarouselLabels = selectedProducts.slice(carouselOffset, carouselOffset + CAROUSEL_VISIBLE);
  const canCarouselLeft   = carouselOffset > 0;
  const canCarouselRight  = carouselOffset + CAROUSEL_VISIBLE < selectedProducts.length;

  return (
    <div className="flex flex-col h-full overflow-x-hidden">

      <div className="px-3">
        <PageBanner
          title="Labels"
          subtitle={store?.ui_resolution === '1024x768' ? \`\${cols} labels/row\` : \`\${paper.label} · \${cols} labels/row · \${LABEL_W_MM}×\${LABEL_H_MM} mm\`}
          icon={<TagIcon className="w-5 h-5 text-white" />}
          action={
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-xs font-medium text-white/70 bg-white/10 border border-white/20 rounded-full px-3 py-1">
                {selected.size} selected
              </span>
              <Button
                id="btn-preview-labels"
                disabled={selected.size === 0}
                onClick={() => setShowPreview(true)}
                size="sm"
                variant="primary"
                className="bg-white/20 hover:bg-white/30 text-white border-white/20 shadow-none"
                leftIcon={<EyeIcon className="w-4 h-4" />}
              >
                Preview
              </Button>
            </div>
          }
        />
      </div>

      {/* Tabs */}
      <div className="px-3 mb-4">
        <div className="bg-white p-1 rounded-2xl border border-gray-200 shadow-soft flex items-center gap-1">
          <button
            onClick={() => setActiveTab('shelf')}
            className={\`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all \${
              activeTab === 'shelf'
                ? 'bg-secondary-600 text-white shadow-brand'
                : 'text-gray-500 hover:bg-gray-50'
            }\`}
          >
            <TagIcon className="w-4 h-4" />
            Shelf Label
          </button>
          <button
            onClick={() => setActiveTab('promotion')}
            className={\`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all \${
              activeTab === 'promotion'
                ? 'bg-secondary-600 text-white shadow-brand'
                : 'text-gray-500 hover:bg-gray-50'
            }\`}
          >
            <PaintBrushIcon className="w-4 h-4" />
            Promotion Label
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === 'shelf' && canEditLayout && layoutForm && (
          <div className="px-3 pt-3 pb-4 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-soft overflow-hidden">
              <button
                type="button"
                onClick={() => setLayoutOpen(!layoutOpen)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary-50 flex items-center justify-center">
                    <PaintBrushIcon className="w-4 h-4 text-secondary-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">Label Designer</p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mt-0.5">Customize layout, fonts & barcodes</p>
                  </div>
                </div>
                {layoutOpen ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
              </button>

              {layoutOpen && (
                <div className="p-5 bg-white border-t border-gray-100">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                      <div className="space-y-6">
                        <LabelSectionFormFields
                          section={activeLabelSection || 'header'}
                          layoutForm={layoutForm}
                          setField={setField}
                        />
                      </div>
                      <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100/50 space-y-4">
                        <ControlRow label="Stacking order">
                          <div className="space-y-1.5">
                            {layoutForm.label_section_order.map((id, i) => {
                              const meta = LABEL_SECTION_META.find(m => m.id === id);
                              const isActive = activeLabelSection === id;
                              return (
                                <div key={id} className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setActiveLabelSection(id)}
                                    className={\`flex-1 flex items-center justify-between px-3 py-2 text-xs font-bold rounded-lg border transition-all \${
                                      isActive
                                        ? 'bg-secondary-50 border-secondary-500 text-secondary-700 shadow-md ring-1 ring-secondary-500'
                                        : 'bg-white border-gray-200 text-gray-700 shadow-sm hover:border-secondary-300'
                                    }\`}
                                  >
                                    <span>{meta?.label ?? id}</span>
                                    <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                                      <button type="button" onClick={() => moveSectionInOrder(i, -1)} disabled={i === 0} className="p-1 hover:text-secondary-600 disabled:opacity-20"><ChevronUpIcon className="w-3 h-3" /></button>
                                      <button type="button" onClick={() => moveSectionInOrder(i, 1)} disabled={i === 4} className="p-1 hover:text-secondary-600 disabled:opacity-20"><ChevronDownIcon className="w-3 h-3" /></button>
                                    </div>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </ControlRow>
                      </div>
                    </div>

                    <div className="lg:col-span-5 flex flex-col items-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-6">Live Designer Preview</p>
                      <div className="relative group">
                        <div className="relative">
                          {previewStore && (
                            <LabelCard
                              storeName={previewStore.name ?? ''}
                              productName={editorProductName}
                              price={editorPrice}
                              currency={currency}
                              barcode={editorBarcode}
                              store={previewStore}
                              interactive
                              activeSection={activeLabelSection}
                              onSectionSelect={setActiveLabelSection}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-5 border-t border-gray-100 flex items-center justify-between">
                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                      Changes affect all labels
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={resetLayout} disabled={savingLayout} className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">Reset</button>
                      <button type="button" onClick={() => void saveLayout()} disabled={savingLayout} className="px-6 py-2 text-xs font-bold text-white bg-secondary-600 rounded-xl hover:bg-secondary-700 disabled:opacity-50 transition-colors shadow-lg">{savingLayout ? 'Saving…' : 'Save changes'}</button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {activeTab === 'promotion' && (
          <div className="px-3 pb-4 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-soft p-4 flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 ml-1">Promotion Text</label>
                <div className="relative">
                  <PaintBrushIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={promoText} onChange={(e) => setPromoText(e.target.value.toUpperCase())} className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-secondary-500 transition-all font-bold text-red-600" placeholder="WEEKEND FRENZY!" />
                </div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 ml-1">Product Origin</label>
                <div className="relative">
                  <BuildingOfficeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={promoOrigin} onChange={(e) => setPromoOrigin(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-secondary-500 transition-all font-medium text-gray-700" placeholder="Product of Australia" />
                </div>
              </div>
              <div className="flex-shrink-0">
                 <Button onClick={() => setShowPreview(true)} disabled={selected.size === 0} variant="primary" size="sm" className="bg-secondary-600 hover:bg-secondary-700 h-[42px] px-6 rounded-xl shadow-lg transition-all" leftIcon={<PrinterIcon className="w-5 h-5" />}>Generate Posters</Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {activeTab === 'shelf' && (
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCarouselOffset(o => Math.max(0, o - 1))} disabled={!canCarouselLeft} className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-25 bg-white shadow-sm"><ChevronLeftIcon className="w-4 h-4" /></button>
                <div className="flex-1 flex items-center justify-center gap-2 min-w-0 overflow-hidden" style={{ height: scaledLabelH }}>
                  {selectedProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center w-full gap-1.5"><TagIcon className="w-6 h-6 text-gray-300" /><p className="text-sm font-semibold text-gray-400">No selection</p></div>
                  ) : (
                    visibleCarouselLabels.map(p => (
                      <div key={p.product_id} style={{ width: scaledLabelW, height: scaledLabelH, flexShrink: 0, overflow: 'hidden', borderRadius: 5 }}>
                        <div style={{ transform: \`scale(\${CAROUSEL_SCALE})\`, transformOrigin: 'top left', width: mmToPx(LABEL_W_MM), height: mmToPx(LABEL_H_MM) }}>
                          <LabelCard storeName={previewStore?.name ?? ''} productName={p.name} price={Number(p.sale_price ?? p.list_price ?? 0)} currency={currency} barcode={p.barcode} store={previewStore} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button type="button" onClick={() => setCarouselOffset(o => Math.min(o + 1, Math.max(0, selectedProducts.length - CAROUSEL_VISIBLE)))} disabled={!canCarouselRight} className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-25 bg-white shadow-sm"><ChevronRightIcon className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {activeTab === 'promotion' && (
             <div className="flex-shrink-0 bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex flex-col items-center justify-center overflow-auto border-b border-gray-200">
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Poster Preview</p>
               {selected.size > 0 ? (
                 <div className="relative shadow-2xl scale-[0.3] origin-center -my-[350px]">
                   <PromotionCard storeName={store?.name ?? 'STORE NAME'} productName={selectedProducts[0]?.name ?? 'PRODUCT NAME'} price={selectedProducts[0]?.sale_price ?? selectedProducts[0]?.list_price ?? 0} unit={selectedProducts[0]?.unit_of_measure || 'kilo'} origin={promoOrigin} promoText={promoText} />
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center py-10 opacity-30 text-center"><TagIcon className="w-10 h-10 mb-2" /><p className="text-sm font-bold">Select products to preview poster</p></div>
               )}
             </div>
          )}

          {/* Product List */}
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="labels-search" type="text" placeholder="Search products..." value={search} onChange={e => handleSearchChange(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 outline-none" />
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-secondary-200 border-t-secondary-600 rounded-full animate-spin" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr>
                      <th className="w-10 px-4 py-3"><button onClick={toggleAll} className={\`w-5 h-5 rounded border-2 flex items-center justify-center \${allOnPageSelected ? 'bg-secondary-600 border-secondary-600' : 'border-gray-300'}\`}>{allOnPageSelected && <CheckIcon className="w-3 h-3 text-white" />}</button></th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Product</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">SKU</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No products found</td></tr>
                    ) : (
                      products.map(p => {
                        const isSelected = selected.has(p.product_id);
                        return (
                          <tr key={p.product_id} onClick={() => toggleOne(p.product_id)} className={\`cursor-pointer transition-colors \${isSelected ? 'bg-secondary-50' : 'hover:bg-gray-50'}\`}>
                            <td className="px-4 py-3"><div className={\`w-5 h-5 rounded border-2 flex items-center justify-center \${isSelected ? 'bg-secondary-600 border-secondary-600' : 'border-gray-300'}\`}>{isSelected && <CheckIcon className="w-3 h-3 text-white" />}</div></td>
                            <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs font-mono">{p.sku || '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">{currency} {Number(p.sale_price ?? p.list_price ?? 0).toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
            {totalPages > 1 && (
              <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between text-sm flex-shrink-0">
                <span className="text-gray-500 text-xs">{totalProducts === 0 ? 'No products' : \`\${(currentPage - 1) * PAGE_SIZE + 1}–\${Math.min(currentPage * PAGE_SIZE, totalProducts)} of \${totalProducts}\`}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30">‹</button>
                  {pageNumbers.map((n, i) => n === '...' ? <span key={\`ellipsis-\${i}\`} className="px-1 text-gray-400 text-xs">…</span> : <button key={n} onClick={() => setCurrentPage(n as number)} className={\`w-7 h-7 rounded text-xs font-medium \${n === currentPage ? 'bg-secondary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}\`}>{n}</button>)}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30">›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPreview && store && previewStore && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary-50 flex items-center justify-center flex-shrink-0"><PrinterIcon className="w-4 h-4 text-secondary-600" /></div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm leading-tight">Print Preview</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedProducts.length} label{selectedProducts.length !== 1 ? 's' : ''} · {paper.label} · {cols} per row</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-6">
                <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-secondary-600 text-white rounded-lg text-sm font-semibold hover:bg-secondary-700 shadow-sm"><PrinterIcon className="w-4 h-4" />Print</button>
                <button onClick={() => setShowPreview(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><XMarkIcon className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="overflow-auto bg-gray-100 p-6 flex-1">
              <div ref={printRef} className="shadow-lg mx-auto" style={{ width: 'fit-content' }}>
                {activeTab === 'shelf' ? <PrintPreview products={selectedProducts} store={previewStore} /> : <PromotionPrintPreview products={selectedProducts} store={previewStore} promoText={promoText} origin={promoOrigin} />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
