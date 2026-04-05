import { useState, useEffect, useRef, useCallback, Fragment, type CSSProperties } from 'react';
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
  PaintBrushIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// ─── Paper size dimensions (mm → pixels at 96 dpi, 1 mm ≈ 3.7795 px) ──────────
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

export type LabelSectionId = 'header' | 'title' | 'lbp' | 'price';

const DEFAULT_LABEL_SECTION_ORDER: LabelSectionId[] = ['header', 'title', 'lbp', 'price'];

const LABEL_SECTION_META: { id: LabelSectionId; label: string; short: string }[] = [
  { id: 'header', label: 'Store name (top bar)', short: 'Store' },
  { id: 'title', label: 'Product name', short: 'Product' },
  { id: 'lbp', label: 'LBP line', short: 'LBP' },
  { id: 'price', label: 'Price band', short: 'Price' },
];

function normalizeSectionOrder(raw: unknown): LabelSectionId[] {
  const valid = new Set<LabelSectionId>(['header', 'title', 'lbp', 'price']);
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
  return out.slice(0, 4);
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

// ─── Label card (single label) ───────────────────────────────────────────────
interface LabelCardProps {
  storeName: string;
  productName: string;
  price: number;
  currency: string;
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
  store,
  style,
  interactive,
  activeSection,
  onSectionSelect,
}: LabelCardProps) {
  const lbpRate = store ? Number(store.lbp_exchange_rate ?? 0) : 0;
  const showLbp =
    !!store && lbpRate > 0 && (store.label_show_lbp ?? true);
  const lbpAmount = showLbp ? Math.round(Number(price) * lbpRate) : 0;
  const editorLbpPlaceholder = !!interactive && !showLbp;
  const tightLayout = showLbp || editorLbpPlaceholder;

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

  const pickLbp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSectionSelect?.('lbp');
  };

  const headerStyle: React.CSSProperties = {
    width: '100%',
    background: '#1a1a1a',
    textAlign: headerAlign,
    padding: '2.5px 6px',
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
    padding: tightLayout ? '4px 8px 2px' : '5px 8px 4px',
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
                padding: '2px 8px 3px',
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
                padding: '2px 8px 3px', boxSizing: 'border-box', gap: lbpRowAlign === 'center' ? 8 : 6,
              }}
            >
              <span style={{ fontSize: lbpPrefixSize, fontWeight: lbpPrefixW, color: '#333333', fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '0.04em', flexShrink: 0 }}>LBP</span>
              <span style={{ fontSize: lbpNumSize, fontWeight: lbpAmtW, color: '#111111', fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '-0.02em', lineHeight: 1, textAlign: lbpRowAlign === 'between' ? 'right' : titleAlign, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{lbpAmount.toLocaleString()}</span>
            </div>
          );
        }

        if (sectionId === 'price') {
          const pricePad = tightLayout ? '4px 6px 5px' : '5px 6px 6px';
          const pricePadStatic = showLbp ? '4px 6px 5px' : '5px 6px 6px';
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
                padding: pricePad,
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
                justifyContent: flexJustify(priceRowAlign), padding: pricePadStatic, boxSizing: 'border-box', flexShrink: 0, gap: 3,
              }}
            >
              <span style={{ fontSize: currencySize, fontWeight: currencyW, color: '#444444', fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '0.02em' }}>{currency}</span>
              <span style={{ fontSize: priceNumSize, fontWeight: priceAmtW, color: '#111111', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'Arial Black, Arial, Helvetica, sans-serif' }}>{Number(price).toFixed(2)}</span>
            </div>
          );
        }

        return <Fragment key={`${index}-unknown`} />;
      })}
    </div>
  );
}

// ─── Print layout ────────────────────────────────────────────────────────────
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
              store={store}
              style={{ width: labelWPx, height: labelHPx, flexShrink: 0 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function selectBaseCls() {
  return 'px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-800 focus:ring-2 focus:ring-secondary-500/30 focus:border-secondary-500 box-border';
}

/** Block selects: full width of container but never exceed panel (avoids horizontal scroll). */
function selectFullCls() {
  return `${selectBaseCls()} w-full max-w-md`;
}

/**
 * Weight dropdowns: fixed width so `w-full` from a shared class cannot stretch them
 * (stretching clipped the native chevron on some browsers).
 */
function selectWeightCls() {
  return `${selectBaseCls()} h-[2.125rem] w-[5rem] min-w-[5rem] max-w-[5rem] shrink-0 pl-2 pr-7 text-left tabular-nums`;
}

function numInputBaseCls() {
  return 'px-2 py-1.5 text-xs rounded-lg border border-gray-200 font-mono box-border min-w-0';
}

function numInputCls() {
  return `${numInputBaseCls()} w-full max-w-md`;
}

/** Size field paired with a weight select: grows in grid column 1 only. */
function numInputPairCls() {
  return `${numInputBaseCls()} w-full max-w-[6rem]`;
}

type SetLabelField = <K extends keyof LabelLayoutFormState>(key: K, value: LabelLayoutFormState[K]) => void;

function LabelSectionFormFields({
  section,
  layoutForm,
  setField,
}: {
  section: LabelSectionId;
  layoutForm: LabelLayoutFormState;
  setField: SetLabelField;
}) {
  switch (section) {
    case 'header':
      return (
        <div className="space-y-3 text-sm max-w-md">
          <label className="block text-gray-500 text-xs font-medium">Alignment</label>
          <select className={selectFullCls()} value={layoutForm.label_header_align} onChange={e => setField('label_header_align', e.target.value as TextAlignLR)}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
          <label className="block text-gray-500 text-xs font-medium">Font size (px)</label>
          <input type="number" min={3} max={40} step={0.5} className={numInputCls()} value={layoutForm.label_store_name_size} onChange={e => setField('label_store_name_size', parseFloat(e.target.value) || 5.5)} />
          <label className="block text-gray-500 text-xs font-medium">Weight</label>
          <select className={selectFullCls()} value={layoutForm.label_header_font_weight} onChange={e => setField('label_header_font_weight', Number(e.target.value))}>
            {WEIGHT_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      );
    case 'title':
      return (
        <div className="space-y-3 text-sm max-w-md">
          <label className="block text-gray-500 text-xs font-medium">Alignment</label>
          <select className={selectFullCls()} value={layoutForm.label_title_align} onChange={e => setField('label_title_align', e.target.value as TextAlignLR)}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
          <label className="block text-gray-500 text-xs font-medium">Font size (px)</label>
          <input type="number" min={6} max={48} step={0.5} className={numInputCls()} value={layoutForm.label_product_name_size} onChange={e => setField('label_product_name_size', parseFloat(e.target.value) || 15)} />
          <label className="block text-gray-500 text-xs font-medium">Weight</label>
          <select className={selectFullCls()} value={layoutForm.label_title_font_weight} onChange={e => setField('label_title_font_weight', Number(e.target.value))}>
            {WEIGHT_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      );
    case 'lbp':
      return (
        <div className="space-y-3 text-sm w-full max-w-md min-w-0 overflow-x-hidden">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={layoutForm.label_show_lbp} onChange={e => setField('label_show_lbp', e.target.checked)} className="rounded border-gray-300 shrink-0" />
            <span>Show LBP line when exchange rate is set</span>
          </label>
          <label className="block text-gray-500 text-xs font-medium">Row layout</label>
          <select className={selectFullCls()} value={layoutForm.label_lbp_row_align} onChange={e => setField('label_lbp_row_align', e.target.value as LbpRowAlign)}>
            <option value="between">Edges (label left, amount right)</option>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500">Prefix “LBP”</p>
            <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2 items-center w-full min-w-0">
              <input type="number" min={4} max={24} step={0.5} className={numInputPairCls()} value={layoutForm.label_lbp_prefix_size} onChange={e => setField('label_lbp_prefix_size', parseFloat(e.target.value) || 10)} />
              <select className={selectWeightCls()} value={layoutForm.label_lbp_prefix_weight} onChange={e => setField('label_lbp_prefix_weight', Number(e.target.value))}>
                {WEIGHT_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500">LBP amount</p>
            <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2 items-center w-full min-w-0">
              <input type="number" min={6} max={48} step={0.5} className={numInputPairCls()} value={layoutForm.label_lbp_size} onChange={e => setField('label_lbp_size', parseFloat(e.target.value) || 14)} />
              <select className={selectWeightCls()} value={layoutForm.label_lbp_amount_weight} onChange={e => setField('label_lbp_amount_weight', Number(e.target.value))}>
                {WEIGHT_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
        </div>
      );
    case 'price':
      return (
        <div className="space-y-3 text-sm w-full max-w-md min-w-0 overflow-x-hidden">
          <label className="block text-gray-500 text-xs font-medium">Row alignment</label>
          <select className={selectFullCls()} value={layoutForm.label_price_row_align} onChange={e => setField('label_price_row_align', e.target.value as TextAlignLR)}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500">Currency code (e.g. USD)</p>
            <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2 items-center w-full min-w-0">
              <input type="number" min={4} max={28} step={0.5} className={numInputPairCls()} value={layoutForm.label_currency_size} onChange={e => setField('label_currency_size', parseFloat(e.target.value) || 11)} />
              <select className={selectWeightCls()} value={layoutForm.label_currency_weight} onChange={e => setField('label_currency_weight', Number(e.target.value))}>
                {WEIGHT_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500">Price amount</p>
            <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2 items-center w-full min-w-0">
              <input type="number" min={8} max={56} step={0.5} className={numInputPairCls()} value={layoutForm.label_price_size} onChange={e => setField('label_price_size', parseFloat(e.target.value) || 30)} />
              <select className={selectWeightCls()} value={layoutForm.label_price_amount_weight} onChange={e => setField('label_price_amount_weight', Number(e.target.value))}>
                {WEIGHT_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

// ─── Main Labels page ─────────────────────────────────────────────────────────
export default function Labels() {
  const { user } = useAuthStore();
  const canEditLayout = user?.role === 'admin' || user?.role === 'manager';

  const [products,     setProducts]     = useState<Product[]>([]);
  const [store,        setStore]        = useState<StoreSettings | null>(null);
  const [layoutForm,   setLayoutForm]   = useState<LabelLayoutFormState | null>(null);
  const [layoutOpen,   setLayoutOpen]   = useState(false);
  const [activeLabelSection, setActiveLabelSection] = useState<LabelSectionId | null>(null);
  const [savingLayout, setSavingLayout] = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [showPreview,  setShowPreview]  = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [storeData, prodData] = await Promise.all([
          storeService.getDefaultStore(),
          productService.getProducts({ limit: 500 }),
        ]);
        if (!active) return;
        setStore(storeData);
        setLayoutForm(labelFormFromStore(storeData));
        setProducts(prodData.data);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

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

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode ?? '').includes(search) ||
    (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.product_id));

  const toggleAll = useCallback(() => {
    if (allFilteredSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(p => next.delete(p.product_id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(p => next.add(p.product_id));
        return next;
      });
    }
  }, [filtered, allFilteredSelected]);

  const selectedProducts = products.filter(p => selected.has(p.product_id));

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
          <title>Shelf Labels</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #fff; }
            @media print {
              html, body { width: 100%; height: 100%; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 0; }
            }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
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

  return (
    <div className="flex flex-col h-full">

      <PageBanner
        title="Shelf Labels"
        subtitle={`${paper.label} · ${cols} label${cols !== 1 ? 's' : ''} per row · ${LABEL_W_MM}×${LABEL_H_MM} mm each`}
        icon={<TagIcon className="w-5 h-5 text-white" />}
        action={
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/70 bg-white/10 border border-white/20 rounded-full px-3 py-1">
              {selected.size} selected
            </span>
            <Button
              id="btn-preview-labels"
              disabled={selected.size === 0}
              onClick={() => setShowPreview(true)}
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              leftIcon={<EyeIcon className="w-4 h-4" />}
            >
              Preview
            </Button>
            <Button
              id="btn-print-labels"
              disabled={selected.size === 0}
              onClick={() => { setShowPreview(true); setTimeout(handlePrint, 100); }}
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              leftIcon={<PrinterIcon className="w-4 h-4" />}
            >
              Print Labels
            </Button>
          </div>
        }
      />

      {canEditLayout && layoutForm && (
        <div className="px-4 pt-3 pb-0 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setLayoutOpen(o => {
                const next = !o;
                if (next) setActiveLabelSection(null);
                return next;
              });
            }}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-secondary-700"
          >
            <PaintBrushIcon className="w-4 h-4 text-secondary-600" />
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${layoutOpen ? 'rotate-180' : ''}`} />
            Label appearance
          </button>
          {layoutOpen && (
            <div className="mt-3 mb-4 p-4 sm:p-5 bg-white rounded-xl border border-gray-200 shadow-sm space-y-4 max-h-[min(85vh,640px)] overflow-y-auto">
              <p className="text-sm text-gray-600 leading-snug">
                Tap a part of the sample label to edit that section. Use the shortcuts below if you prefer.
              </p>

              <div className="rounded-xl border border-gray-200 bg-gray-50/90 p-3 sm:p-4 max-w-lg">
                <p className="text-xs font-semibold text-gray-700 mb-2">Section order (top → bottom)</p>
                <ul className="space-y-1">
                  {layoutForm.label_section_order.map((id, idx) => {
                    const meta = LABEL_SECTION_META.find(m => m.id === id);
                    return (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white border border-gray-100 px-2.5 py-1.5"
                      >
                        <span className="text-sm text-gray-800 truncate">{meta?.label ?? id}</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 disabled:hover:bg-transparent"
                            disabled={idx === 0}
                            aria-label="Move section up"
                            onClick={() => moveSectionInOrder(idx, -1)}
                          >
                            <ChevronUpIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 disabled:hover:bg-transparent"
                            disabled={idx >= layoutForm.label_section_order.length - 1}
                            aria-label="Move section down"
                            onClick={() => moveSectionInOrder(idx, 1)}
                          >
                            <ChevronDownIcon className="w-4 h-4" />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-8">
                <div className="flex flex-col items-center gap-3 shrink-0 mx-auto lg:mx-0">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sample label</span>
                  {previewStore && (
                    <LabelCard
                      storeName={previewStore.name ?? ''}
                      productName={editorProductName}
                      price={editorPrice}
                      currency={currency}
                      store={previewStore}
                      interactive
                      activeSection={activeLabelSection}
                      onSectionSelect={setActiveLabelSection}
                    />
                  )}
                  <div className="flex flex-wrap justify-center gap-1.5 max-w-[16rem]">
                    {layoutForm.label_section_order.map(id => {
                      const short = LABEL_SECTION_META.find(m => m.id === id)?.short ?? id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setActiveLabelSection(id)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            activeLabelSection === id
                              ? 'bg-secondary-600 text-white border-secondary-600'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-secondary-300'
                          }`}
                        >
                          {short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 min-w-0 w-full border-t lg:border-t-0 lg:border-l border-gray-100 pt-4 lg:pt-0 lg:pl-8">
                  {activeLabelSection === null ? (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 px-4 py-10 text-center">
                      <p className="text-sm text-gray-600 font-medium">Choose a section</p>
                      <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto">
                        Click the store bar, product name, LBP line, or price band on the label, or use the shortcuts under the preview.
                      </p>
                    </div>
                  ) : (
                    <div className="min-w-0 w-full max-w-lg overflow-x-hidden">
                      <h3 className="text-base font-bold text-gray-900 mb-1">
                        {LABEL_SECTION_META.find(m => m.id === activeLabelSection)?.label}
                      </h3>
                      <p className="text-xs text-gray-500 mb-4">
                        Changes apply to all printed shelf labels for this store.
                      </p>
                      <LabelSectionFormFields
                        section={activeLabelSection}
                        layoutForm={layoutForm}
                        setField={setField}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 pt-3 border-t border-gray-100">
                <Button size="sm" onClick={() => void saveLayout()} disabled={savingLayout} className="font-semibold w-full sm:w-auto">
                  {savingLayout ? 'Saving…' : 'Save to store'}
                </Button>
                <Button size="sm" variant="outline" onClick={resetLayout} disabled={savingLayout} className="w-full sm:w-auto">
                  Reset
                </Button>
                <p className="text-[11px] text-gray-500 sm:ml-1">
                  LBP preview needs an exchange rate under Admin → Store → Regional.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-5 flex-1 min-h-0 px-4 pb-4 min-h-0">

        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="labels-search"
                type="text"
                placeholder="Search products by name, SKU or barcode…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-8 h-8 border-4 border-secondary-200 border-t-secondary-600 rounded-full animate-spin" />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr>
                    <th className="w-10 px-4 py-3 text-left">
                      <button
                        id="labels-select-all"
                        onClick={toggleAll}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          allFilteredSelected
                            ? 'bg-secondary-600 border-secondary-600'
                            : 'border-gray-300 hover:border-secondary-400'
                        }`}
                      >
                        {allFilteredSelected && <CheckIcon className="w-3 h-3 text-white" />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Product</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">SKU</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 text-xs uppercase tracking-wide">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                        No products found
                      </td>
                    </tr>
                  ) : (
                    filtered.map(p => {
                      const isSelected = selected.has(p.product_id);
                      return (
                        <tr
                          key={p.product_id}
                          onClick={() => toggleOne(p.product_id)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-secondary-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-3">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-secondary-600 border-secondary-600'
                                  : 'border-gray-300'
                              }`}
                            >
                              {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono">{p.sku || '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">
                            {currency} {Number(p.sale_price ?? p.list_price ?? 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="w-full xl:w-72 xl:max-w-sm flex-shrink-0 flex flex-col gap-3 min-h-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Label Preview</p>
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 overflow-auto flex flex-col gap-2">
            {selectedProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center mt-10">Select products to preview labels</p>
            ) : (
              selectedProducts.slice(0, 12).map(p => (
                <LabelCard
                  key={p.product_id}
                  storeName={previewStore?.name ?? ''}
                  productName={p.name}
                  price={p.sale_price ?? p.list_price ?? 0}
                  currency={currency}
                  store={previewStore}
                />
              ))
            )}
            {selectedProducts.length > 12 && (
              <p className="text-xs text-gray-400 text-center">+{selectedProducts.length - 12} more…</p>
            )}
          </div>
        </div>
      </div>

      {showPreview && store && previewStore && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: '90vh', maxWidth: '90vw' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary-50 flex items-center justify-center flex-shrink-0">
                  <PrinterIcon className="w-4 h-4 text-secondary-600" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm leading-tight">Print Preview</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedProducts.length} label{selectedProducts.length !== 1 ? 's' : ''} · {paper.label} · {cols} per row
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-6">
                <button
                  id="modal-print-labels"
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary-600 text-white rounded-lg text-sm font-semibold hover:bg-secondary-700 transition-colors shadow-sm"
                >
                  <PrinterIcon className="w-4 h-4" />
                  Print
                </button>
                <button
                  id="modal-close-preview"
                  onClick={() => setShowPreview(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-auto bg-gray-100 p-6 flex-1">
              <div ref={printRef} className="shadow-lg mx-auto" style={{ width: 'fit-content' }}>
                <PrintPreview products={selectedProducts} store={previewStore} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
