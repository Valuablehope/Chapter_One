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
  ChevronLeftIcon,
  ChevronRightIcon,
  PaintBrushIcon,
  BuildingOfficeIcon,
  ArrowsPointingOutIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { restoreInputFocus } from '../utils/nativeDialogFocusFix';

// ─── Constants ───────────────────────────────────────────────────────────────
const MM_TO_PX = 3.7795;

const PAPER_PRESETS: Record<string, { widthMM: number; heightMM: number; label: string }> = {
  '80mm':   { widthMM: 80,  heightMM: 297, label: '80mm Receipt' },
  '58mm':   { widthMM: 58,  heightMM: 297, label: '58mm Receipt' },
  'A4':     { widthMM: 210, heightMM: 297, label: 'A4' },
  'Letter': { widthMM: 216, heightMM: 279, label: 'Letter' },
  'A5':     { widthMM: 148, heightMM: 210, label: 'A5' },
};

const LABEL_W_MM  = 60;
const GAP_MM      = 4;
const MARGIN_MM   = 8;
const DEFAULT_H_MM = 40;
const MIN_H_MM     = 20;
const MAX_H_MM     = 100;

export type LabelSectionId = 'header' | 'title' | 'lbp' | 'price' | 'barcode';

const SECTION_META: { id: LabelSectionId; label: string; color: string }[] = [
  { id: 'header',  label: 'Store Name',    color: '#1a1a1a' },
  { id: 'title',   label: 'Product Name',  color: '#3b82f6' },
  { id: 'lbp',     label: 'LBP Price',     color: '#8b5cf6' },
  { id: 'price',   label: 'Price',         color: '#ef4444' },
  { id: 'barcode', label: 'Barcode',       color: '#10b981' },
];

// ─── Canvas element type ─────────────────────────────────────────────────────
export interface CanvasElement {
  id: LabelSectionId;
  visible: boolean;
  x: number;       // 0–100 % of label width
  y: number;       // 0–100 % of label height
  rotation: number; // degrees
  scale: number;    // 1.0 = default
  width: number;    // container width as % of label width (10–95)
}

const DEFAULT_CANVAS_ELEMENTS: CanvasElement[] = [
  { id: 'header',  visible: true,  x: 50, y: 6,  rotation: 0, scale: 1, width: 88 },
  { id: 'title',   visible: true,  x: 50, y: 28, rotation: 0, scale: 1, width: 88 },
  { id: 'lbp',     visible: true,  x: 50, y: 48, rotation: 0, scale: 1, width: 80 },
  { id: 'price',   visible: true,  x: 50, y: 66, rotation: 0, scale: 1, width: 80 },
  { id: 'barcode', visible: true,  x: 50, y: 85, rotation: 0, scale: 1, width: 88 },
];

function parseCanvasElements(raw: unknown): CanvasElement[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_CANVAS_ELEMENTS.map(e => ({ ...e }));
  const ids = new Set<LabelSectionId>(['header', 'title', 'lbp', 'price', 'barcode']);
  const seen = new Set<string>();
  const out: CanvasElement[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as Record<string, unknown>).id as string;
    if (!ids.has(id as LabelSectionId) || seen.has(id)) continue;
    seen.add(id);
    const def = DEFAULT_CANVAS_ELEMENTS.find(d => d.id === id);
    out.push({
      id: id as LabelSectionId,
      visible: (item as Record<string, unknown>).visible !== false,
      x: Number((item as Record<string, unknown>).x) || 50,
      y: Number((item as Record<string, unknown>).y) || 10,
      rotation: Number((item as Record<string, unknown>).rotation) || 0,
      scale: Number((item as Record<string, unknown>).scale) || 1,
      width: Number((item as Record<string, unknown>).width) || def?.width || 88,
    });
  }
  // Ensure all 5 sections are present
  for (const def of DEFAULT_CANVAS_ELEMENTS) {
    if (!seen.has(def.id)) out.push({ ...def });
  }
  return out;
}

// ─── Typography form state ────────────────────────────────────────────────────
export interface LabelLayoutFormState {
  label_show_lbp: boolean;
  label_store_name_size: number;
  label_product_name_size: number;
  label_lbp_size: number;
  label_price_size: number;
  label_header_align: 'left' | 'center' | 'right';
  label_header_font_weight: number;
  label_title_align: 'left' | 'center' | 'right';
  label_title_font_weight: number;
  label_lbp_row_align: 'between' | 'left' | 'center' | 'right';
  label_lbp_prefix_size: number;
  label_lbp_prefix_weight: number;
  label_lbp_amount_weight: number;
  label_price_row_align: 'left' | 'center' | 'right';
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
  // Canvas-specific
  label_height_mm: number;
  label_canvas_elements: CanvasElement[];
}

// ─── Helper functions ─────────────────────────────────────────────────────────
function mmToPx(mm: number) { return Math.round(mm * MM_TO_PX); }
function labelFontSize(v: number | null | undefined, fallback: number): number {
  const n = Number(v); return Number.isFinite(n) && n > 0 ? n : fallback;
}
function normalizeTextAlign(v: string | null | undefined, fallback: 'left' | 'center' | 'right'): 'left' | 'center' | 'right' {
  if (v === 'left' || v === 'center' || v === 'right') return v; return fallback;
}
function normalizeLbpRowAlign(v: string | null | undefined): 'between' | 'left' | 'center' | 'right' {
  if (v === 'between' || v === 'left' || v === 'center' || v === 'right') return v; return 'between';
}
function clampWeight(v: number | null | undefined, fallback: number): number {
  const n = Number(v); if (!Number.isFinite(n)) return fallback;
  return Math.min(900, Math.max(100, Math.round(n / 100) * 100));
}
function flexJustify(a: string): NonNullable<CSSProperties['justifyContent']> {
  return a === 'left' ? 'flex-start' : a === 'right' ? 'flex-end' : 'center';
}

function getPaperDims(paperSize: string | undefined) {
  const key = Object.keys(PAPER_PRESETS).find(k => k.toLowerCase() === (paperSize || '').toLowerCase()) || 'A4';
  return PAPER_PRESETS[key]!;
}
function calcGrid(paperWidthMM: number) {
  const usable = paperWidthMM - MARGIN_MM * 2;
  return Math.max(1, Math.floor((usable + GAP_MM) / (LABEL_W_MM + GAP_MM)));
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
    label_section_order: (() => {
      const def: LabelSectionId[] = ['header', 'title', 'lbp', 'price', 'barcode'];
      if (!Array.isArray(s.label_section_order)) return def;
      return def; // canvas mode ignores stacking order
    })(),
    label_height_mm: labelFontSize(s.label_height_mm, DEFAULT_H_MM),
    label_canvas_elements: parseCanvasElements(s.label_canvas_elements),
  };
}

function mergeLabelFormIntoStore(base: StoreSettings, form: LabelLayoutFormState): StoreSettings {
  return { ...base, ...form };
}

// ─── Code 128B barcode ────────────────────────────────────────────────────────
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
  '211412','211214','211232',
];
const C128_STOP = '2331112';

function code128b(text: string): boolean[] {
  if (!text) return [];
  const START_B = 104;
  let check = START_B;
  const codes = [START_B];
  for (let i = 0; i < text.length; i++) {
    const v = Math.max(0, Math.min(95, text.charCodeAt(i) - 32));
    codes.push(v);
    check += v * (i + 1);
  }
  codes.push(check % 103);
  const bits: boolean[] = [];
  const push = (pat: string) => {
    let bar = true;
    for (const ch of pat) { for (let k = 0; k < parseInt(ch, 10); k++) bits.push(bar); bar = !bar; }
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
    if (last && last.x + last.w === i) last.w++; else rects.push({ x: i, w: 1 });
  }
  return (
    <svg viewBox={`0 0 ${bits.length} ${barHeight}`} width="100%" height={barHeight}
      preserveAspectRatio="none" style={{ display: 'block' }} aria-hidden="true">
      {rects.map((r, i) => <rect key={i} x={r.x} y={0} width={r.w} height={barHeight} fill="#000" />)}
    </svg>
  );
}

// ─── Canvas label renderer (absolute-positioned elements) ────────────────────
interface CanvasLabelProps {
  storeName: string;
  productName: string;
  price: number;
  currency: string;
  barcode?: string;
  store: StoreSettings | null;
  form: LabelLayoutFormState;
  style?: CSSProperties;
  interactive?: boolean;
  activeElement?: LabelSectionId | null;
  onElementSelect?: (id: LabelSectionId) => void;
  onElementDragStart?: (id: LabelSectionId, e: React.PointerEvent) => void;
  onElementResizeStart?: (id: LabelSectionId, side: 'left' | 'right', e: React.PointerEvent) => void;
}

function CanvasLabel({
  storeName, productName, price, currency, barcode,
  store, form, style, interactive, activeElement,
  onElementSelect, onElementDragStart, onElementResizeStart,
}: CanvasLabelProps) {
  const lbpRate   = store ? Number(store.lbp_exchange_rate ?? 0) : 0;
  const lbpEnabled = form.label_show_lbp;
  const showLbp   = lbpEnabled && lbpRate > 0;
  const lbpAmount = showLbp ? Math.round(Number(price) * lbpRate) : 0;
  const showBarcode = form.label_show_barcode;
  const barcodeBits = showBarcode && barcode ? code128b(barcode) : [];

  const labelWPx = mmToPx(LABEL_W_MM);
  const labelHPx = mmToPx(form.label_height_mm);

  return (
    <div
      style={{
        width: labelWPx, height: labelHPx,
        border: '1.5px solid #1a1a1a', borderRadius: 5,
        background: '#ffffff', boxSizing: 'border-box',
        position: 'relative', overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif',
        userSelect: 'none',
        ...style,
      }}
    >
      {form.label_canvas_elements.map(el => {
        if (!el.visible) return <Fragment key={el.id} />;

        const isActive = activeElement === el.id;
        const left = `${el.x}%`;
        const top  = `${el.y}%`;
        const transform = `translate(-50%, -50%) rotate(${el.rotation}deg) scale(${el.scale})`;

        const wrapStyle: CSSProperties = {
          position: 'absolute', left, top, transform,
          transformOrigin: 'center center',
          cursor: interactive ? 'grab' : 'default',
          boxSizing: 'border-box',
          width: `${el.width}%`,
        };

        const ringStyle: CSSProperties = isActive && interactive ? {
          outline: '2px solid #3b82f6',
          outlineOffset: 2,
          borderRadius: 3,
        } : {};

        const meta = SECTION_META.find(m => m.id === el.id);

        const handlePointerDown = (e: React.PointerEvent) => {
          if (!interactive) return;
          e.stopPropagation();
          onElementSelect?.(el.id);
          onElementDragStart?.(el.id, e);
        };

        let content: React.ReactNode = null;

        if (el.id === 'header') {
          content = (
            <div style={{
              background: '#1a1a1a', color: '#fff',
              padding: `${form.label_header_pad_v}px 8px`,
              textAlign: form.label_header_align,
              fontSize: form.label_store_name_size,
              fontWeight: form.label_header_font_weight,
              textTransform: 'uppercase', letterSpacing: '0.18em',
              whiteSpace: 'nowrap',
              borderRadius: 3,
              minWidth: 60,
            }}>
              {storeName}
            </div>
          );
        } else if (el.id === 'title') {
          content = (
            <div style={{
              color: '#111', padding: `${form.label_title_pad_v}px 4px`,
              textAlign: form.label_title_align,
              fontSize: form.label_product_name_size,
              fontWeight: form.label_title_font_weight,
              lineHeight: 1.15, wordBreak: 'break-word',
              width: '100%',
            }}>
              {productName}
            </div>
          );
        } else if (el.id === 'lbp') {
          if (!lbpEnabled) return <Fragment key={el.id} />;
          content = (
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: 5, padding: `${form.label_lbp_pad_v}px 4px`,
              background: interactive && !showLbp ? '#fafafa' : undefined,
              borderRadius: 3, minWidth: 60,
            }}>
              {showLbp ? (
                <>
                  <span style={{ fontSize: form.label_lbp_prefix_size, fontWeight: form.label_lbp_prefix_weight, color: '#333', letterSpacing: '0.04em' }}>LBP</span>
                  <span style={{ fontSize: form.label_lbp_size, fontWeight: form.label_lbp_amount_weight, color: '#111', letterSpacing: '-0.02em' }}>{lbpAmount.toLocaleString()}</span>
                </>
              ) : (
                <span style={{ fontSize: 8, color: '#aaa', fontWeight: 600 }}>LBP — set exchange rate</span>
              )}
            </div>
          );
        } else if (el.id === 'price') {
          content = (
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 2,
              padding: `${form.label_price_pad_v}px 4px`,
              background: '#f4f4f4', borderRadius: 3,
              justifyContent: flexJustify(form.label_price_row_align),
              minWidth: 60,
            }}>
              <span style={{ fontSize: form.label_currency_size, fontWeight: form.label_currency_weight, color: '#444', letterSpacing: '0.02em' }}>{currency}</span>
              <span style={{ fontSize: form.label_price_size, fontWeight: form.label_price_amount_weight, color: '#111', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'Arial Black, Arial, sans-serif' }}>{Number(price).toFixed(2)}</span>
            </div>
          );
        } else if (el.id === 'barcode') {
          if (!showBarcode && !interactive) return <Fragment key={el.id} />;
          content = (
            <div style={{ padding: `${form.label_barcode_pad_v}px 4px`, textAlign: 'center', minWidth: 60 }}>
              {barcodeBits.length > 0 ? (
                <>
                  <BarcodeRenderer bits={barcodeBits} barHeight={form.label_barcode_height} />
                  <div style={{ fontSize: form.label_barcode_text_size, fontFamily: 'monospace', color: '#111', letterSpacing: '0.06em', lineHeight: 1, marginTop: 1 }}>{barcode}</div>
                </>
              ) : (
                <div style={{ fontSize: 8, color: '#aaa', fontWeight: 600, padding: '2px 0' }}>
                  {!showBarcode ? 'Barcode hidden' : 'No barcode'}
                </div>
              )}
            </div>
          );
        }

        if (!content) return <Fragment key={el.id} />;

        return (
          <div
            key={el.id}
            style={{ ...wrapStyle, ...ringStyle, position: 'absolute' }}
            onPointerDown={handlePointerDown}
            title={interactive ? `Drag to move ${meta?.label}` : undefined}
          >
            {content}

            {/* Left resize handle — always present for cursor hint, visible bar when active */}
            {interactive && (
              <div
                style={{
                  position: 'absolute', left: -5, top: 0, bottom: 0, width: 10,
                  cursor: 'ew-resize', zIndex: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onPointerDown={(e) => { e.stopPropagation(); onElementSelect?.(el.id); onElementResizeStart?.(el.id, 'left', e); }}
              >
                {isActive && (
                  <div style={{ width: 3, height: 20, background: '#3b82f6', borderRadius: 2, opacity: 0.9 }} />
                )}
              </div>
            )}

            {/* Right resize handle */}
            {interactive && (
              <div
                style={{
                  position: 'absolute', right: -5, top: 0, bottom: 0, width: 10,
                  cursor: 'ew-resize', zIndex: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onPointerDown={(e) => { e.stopPropagation(); onElementSelect?.(el.id); onElementResizeStart?.(el.id, 'right', e); }}
              >
                {isActive && (
                  <div style={{ width: 3, height: 20, background: '#3b82f6', borderRadius: 2, opacity: 0.9 }} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Static stacked label for print preview (backward-compatible) ─────────────
interface StaticLabelProps {
  storeName: string; productName: string; price: number; currency: string; barcode?: string;
  store: StoreSettings; form: LabelLayoutFormState; style?: CSSProperties;
}

function StaticLabel({ storeName, productName, price, currency, barcode, store, form, style }: StaticLabelProps) {
  const lbpRate   = Number(store.lbp_exchange_rate ?? 0);
  const showLbp   = form.label_show_lbp && lbpRate > 0;
  const lbpAmount = showLbp ? Math.round(Number(price) * lbpRate) : 0;
  const barcodeBits = form.label_show_barcode && barcode ? code128b(barcode) : [];
  const labelWPx = mmToPx(LABEL_W_MM);
  const labelHPx = mmToPx(form.label_height_mm);

  // Render using same canvas-element positions as the designer
  return (
    <div style={{
      width: labelWPx, height: labelHPx,
      border: '1.5px solid #1a1a1a', borderRadius: 5, background: '#ffffff',
      boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
      fontFamily: 'Arial, Helvetica, sans-serif', ...style,
    }}>
      {form.label_canvas_elements.map(el => {
        if (!el.visible) return <Fragment key={el.id} />;
        const transform = `translate(-50%, -50%) rotate(${el.rotation}deg) scale(${el.scale})`;
        const base: CSSProperties = {
          position: 'absolute', left: `${el.x}%`, top: `${el.y}%`,
          transform, transformOrigin: 'center center', boxSizing: 'border-box',
          width: `${el.width}%`,
        };

        if (el.id === 'header') return (
          <div key={el.id} style={{ ...base }}>
            <div style={{ background: '#1a1a1a', color: '#fff', padding: `${form.label_header_pad_v}px 8px`, textAlign: form.label_header_align, fontSize: form.label_store_name_size, fontWeight: form.label_header_font_weight, textTransform: 'uppercase', letterSpacing: '0.18em', whiteSpace: 'nowrap', borderRadius: 3, minWidth: 60 }}>{storeName}</div>
          </div>
        );
        if (el.id === 'title') return (
          <div key={el.id} style={{ ...base }}>
            <div style={{ color: '#111', padding: `${form.label_title_pad_v}px 4px`, textAlign: form.label_title_align, fontSize: form.label_product_name_size, fontWeight: form.label_title_font_weight, lineHeight: 1.15, wordBreak: 'break-word', width: '100%' }}>{productName}</div>
          </div>
        );
        if (el.id === 'lbp') {
          if (!form.label_show_lbp || !showLbp) return <Fragment key={el.id} />;
          return (
            <div key={el.id} style={{ ...base }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: `${form.label_lbp_pad_v}px 4px`, minWidth: 60 }}>
                <span style={{ fontSize: form.label_lbp_prefix_size, fontWeight: form.label_lbp_prefix_weight, color: '#333', letterSpacing: '0.04em' }}>LBP</span>
                <span style={{ fontSize: form.label_lbp_size, fontWeight: form.label_lbp_amount_weight, color: '#111', letterSpacing: '-0.02em' }}>{lbpAmount.toLocaleString()}</span>
              </div>
            </div>
          );
        }
        if (el.id === 'price') return (
          <div key={el.id} style={{ ...base }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, padding: `${form.label_price_pad_v}px 4px`, background: '#f4f4f4', borderRadius: 3, justifyContent: flexJustify(form.label_price_row_align), minWidth: 60 }}>
              <span style={{ fontSize: form.label_currency_size, fontWeight: form.label_currency_weight, color: '#444' }}>{currency}</span>
              <span style={{ fontSize: form.label_price_size, fontWeight: form.label_price_amount_weight, color: '#111', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'Arial Black, Arial, sans-serif' }}>{Number(price).toFixed(2)}</span>
            </div>
          </div>
        );
        if (el.id === 'barcode') {
          if (!form.label_show_barcode) return <Fragment key={el.id} />;
          return (
            <div key={el.id} style={{ ...base }}>
              <div style={{ padding: `${form.label_barcode_pad_v}px 4px`, textAlign: 'center', minWidth: 60 }}>
                {barcodeBits.length > 0 ? (
                  <>
                    <BarcodeRenderer bits={barcodeBits} barHeight={form.label_barcode_height} />
                    <div style={{ fontSize: form.label_barcode_text_size, fontFamily: 'monospace', color: '#111', letterSpacing: '0.06em', lineHeight: 1, marginTop: 1 }}>{barcode}</div>
                  </>
                ) : null}
              </div>
            </div>
          );
        }
        return <Fragment key={el.id} />;
      })}
    </div>
  );
}

// ─── Print preview ────────────────────────────────────────────────────────────
function PrintPreview({ products, store, form }: { products: Product[]; store: StoreSettings; form: LabelLayoutFormState }) {
  const paper  = getPaperDims(store.paper_size);
  const cols   = calcGrid(paper.widthMM);
  const currency = store.currency_code || 'USD';
  const marginPx = mmToPx(MARGIN_MM);
  const gapPx    = mmToPx(GAP_MM);
  const rows: Product[][] = [];
  for (let i = 0; i < products.length; i += cols) rows.push(products.slice(i, i + cols));

  return (
    <div id="labels-print-root" style={{ width: mmToPx(paper.widthMM), background: '#fff', padding: marginPx, boxSizing: 'border-box' }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: gapPx, marginBottom: ri < rows.length - 1 ? gapPx : 0 }}>
          {row.map(p => (
            <StaticLabel key={p.product_id} storeName={store.name} productName={p.name}
              price={p.sale_price ?? p.list_price ?? 0} currency={currency}
              barcode={p.barcode} store={store} form={form}
              style={{ flexShrink: 0 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Promotion poster (unchanged from original) ───────────────────────────────
function starPolygon(cx: number, cy: number, outerR: number, innerR: number, pts: number): string {
  const step = (2 * Math.PI) / pts;
  return Array.from({ length: pts }, (_, i) => {
    const a1 = i * step - Math.PI / 2;
    const a2 = a1 + step / 2;
    return [`${(cx + outerR * Math.cos(a1)).toFixed(2)},${(cy + outerR * Math.sin(a1)).toFixed(2)}`, `${(cx + innerR * Math.cos(a2)).toFixed(2)},${(cy + innerR * Math.sin(a2)).toFixed(2)}`].join(' ');
  }).join(' ');
}

function PromotionCard({ storeName, productName, price, unit, origin, promoText, style }: {
  storeName: string; productName: string; price: number; unit: string; origin?: string; promoText: string; style?: CSSProperties;
}) {
  const [dollars, cents] = Number(price).toFixed(2).split('.');
  const GREEN = '#1B5E2F', RED = '#D0001B';
  return (
    <div className="promotion-poster" style={{ width: '210mm', height: '297mm', backgroundColor: '#F8F8F6', position: 'relative', overflow: 'hidden', fontFamily: "'DM Sans', system-ui, sans-serif", WebkitPrintColorAdjust: 'exact' as CSSProperties['WebkitPrintColorAdjust'], ...style }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.045) 1.2px, transparent 1.2px)', backgroundSize: '20px 20px' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16mm 16mm 14mm', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: '11mm', flexShrink: 0 }}>
          <p style={{ fontSize: '14pt', fontWeight: 700, color: '#3C3C3C', letterSpacing: '0.38em', textTransform: 'uppercase', margin: 0 }}>{storeName}</p>
          <div style={{ width: '15mm', height: '1px', backgroundColor: '#3C3C3C', opacity: 0.5, margin: '3mm auto 0' }} />
        </div>
        <div style={{ textAlign: 'center', width: '100%', marginBottom: '9mm', flexShrink: 0 }}>
          <h1 style={{ fontSize: '60pt', fontWeight: 800, color: GREEN, lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0, textTransform: 'uppercase' }}>{productName}</h1>
          {origin && <p style={{ fontSize: '20pt', fontWeight: 600, color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '3mm 0 0 0' }}>{origin}</p>}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', lineHeight: 1 }}>
            <span style={{ fontSize: '60pt', fontWeight: 800, color: RED, lineHeight: 1, marginTop: '15mm', marginRight: '2mm' }}>$</span>
            <span style={{ fontSize: '200pt', fontWeight: 800, color: RED, lineHeight: 0.85, letterSpacing: '-0.04em' }}>{dollars}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingTop: '6mm', paddingLeft: '3mm', gap: '4mm' }}>
              <span style={{ fontSize: '80pt', fontWeight: 800, color: RED, lineHeight: 1, textDecoration: 'underline', textDecorationThickness: '5px', textUnderlineOffset: '8px' }}>{cents}</span>
              <span style={{ fontSize: '14pt', fontWeight: 700, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase' }}>/ {unit}</span>
            </div>
          </div>
        </div>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexShrink: 0, minHeight: '60mm' }}>
          <div style={{ width: '90mm', height: '90mm', flexShrink: 0, filter: 'drop-shadow(4px 4px 8px rgba(0,0,0,0.15))', position: 'relative' }}>
            <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
              <polygon points={starPolygon(50, 50, 48, 32, 12)} fill={RED} stroke="#F8F8F6" strokeWidth="1.5" />
            </svg>
            <div style={{ position: 'absolute', inset: '15%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <span style={{ color: 'white', fontWeight: 900, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '24pt', lineHeight: 1.1, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{promoText}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PromotionPrintPreview({ products, store, promoText, origin }: { products: Product[]; store: StoreSettings; promoText: string; origin: string }) {
  return (
    <div id="labels-print-root" className="bg-gray-200 flex flex-col gap-8">
      {products.map(p => (
        <div key={p.product_id} className="bg-white shadow-xl mx-auto" style={{ width: '210mm', height: '297mm', pageBreakAfter: 'always' }}>
          <PromotionCard storeName={store.name} productName={p.name} price={p.sale_price ?? p.list_price ?? 0} unit={p.unit_of_measure || 'kilo'} origin={origin} promoText={promoText} />
        </div>
      ))}
    </div>
  );
}

// ─── Designer sub-components ──────────────────────────────────────────────────
const WEIGHT_OPTIONS = [400, 500, 600, 700, 800, 900] as const;

function SizeSlider({ value, min, max, step = 0.5, onChange, fallback }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fallback: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400 font-mono">{min}</span>
        <span className="text-xs font-bold text-secondary-700 tabular-nums bg-secondary-50 px-2 py-0.5 rounded-md border border-secondary-100">{value}px</span>
        <span className="text-[10px] text-gray-400 font-mono">{max}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || fallback)}
        className="w-full h-1.5 appearance-none bg-gray-200 rounded-full outline-none cursor-pointer"
        style={{ accentColor: '#3582e2' }} />
    </div>
  );
}

function WeightGrid({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl">
      {WEIGHT_OPTIONS.map(w => (
        <button key={w} type="button" onClick={() => onChange(w)}
          className={`py-1.5 rounded-lg text-xs transition-all ${value === w ? 'bg-white text-secondary-700 shadow-sm font-black' : 'text-gray-500 hover:text-gray-700 font-semibold'}`}
          style={{ fontWeight: w }}>{w}</button>
      ))}
    </div>
  );
}

function AlignSegment({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="grid p-1 bg-gray-100 rounded-xl" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${value === o.value ? 'bg-white text-secondary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ControlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );
}

// ─── Main Labels page ─────────────────────────────────────────────────────────
export default function Labels() {
  const { user } = useAuthStore();
  const canEditLayout = user?.role === 'admin' || user?.role === 'manager';
  const PAGE_SIZE = 50;

  const [products,               setProducts]               = useState<Product[]>([]);
  const [store,                  setStore]                  = useState<StoreSettings | null>(null);
  const [layoutForm,             setLayoutForm]             = useState<LabelLayoutFormState | null>(null);
  const [layoutOpen,             setLayoutOpen]             = useState(false);
  const [activeElement,          setActiveElement]          = useState<LabelSectionId | null>(null);
  const [savingLayout,           setSavingLayout]           = useState(false);
  const [loading,                setLoading]                = useState(true);
  const [search,                 setSearch]                 = useState('');
  const [searchQuery,            setSearchQuery]            = useState('');
  const [selected,               setSelected]               = useState<Set<string>>(new Set());
  const [selectedProductDetails, setSelectedProductDetails] = useState<Map<string, Product>>(new Map());
  const [currentPage,            setCurrentPage]            = useState(1);
  const [totalPages,             setTotalPages]             = useState(1);
  const [totalProducts,          setTotalProducts]          = useState(0);
  const [showPreview,            setShowPreview]            = useState(false);
  const [activeTab,              setActiveTab]              = useState<'shelf' | 'promotion'>('shelf');
  const [promoText,              setPromoText]              = useState('WEEKEND FRENZY!');
  const [promoOrigin,            setPromoOrigin]            = useState('PRODUCT OF AUSTRALIA');
  const [carouselOffset,         setCarouselOffset]         = useState(0);

  // Drag state
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    id: LabelSectionId;
    mode: 'move' | 'resize-left' | 'resize-right';
    startX: number; startY: number;
    origX: number; origY: number;
    origRot: number;
    origWidth: number;
    labelW: number; labelH: number;
  } | null>(null);

  const printRef          = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    storeService.getDefaultStore().then(s => { if (!active) return; setStore(s); setLayoutForm(labelFormFromStore(s)); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const d = await productService.getProducts({ page: currentPage, limit: PAGE_SIZE, search: searchQuery || undefined }, ctrl.signal);
        if (!active) return;
        setProducts(d.data); setTotalPages(d.pagination.totalPages); setTotalProducts(d.pagination.total);
      } catch (e: unknown) {
        const err = e as { name?: string; code?: string };
        if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; ctrl.abort(); };
  }, [currentPage, searchQuery]);

  useEffect(() => { setCarouselOffset(0); }, [selected]);

  const displayStore = store && layoutForm ? mergeLabelFormIntoStore(store, layoutForm) : store;

  const setField = useCallback(<K extends keyof LabelLayoutFormState>(key: K, value: LabelLayoutFormState[K]) => {
    setLayoutForm(prev => prev ? { ...prev, [key]: value } : prev);
  }, []);

  const updateElement = useCallback((id: LabelSectionId, patch: Partial<CanvasElement>) => {
    setLayoutForm(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        label_canvas_elements: prev.label_canvas_elements.map(el => el.id === id ? { ...el, ...patch } : el),
      };
    });
  }, []);

  // Drag-to-move pointer events on the canvas
  const handleElementDragStart = useCallback((id: LabelSectionId, e: React.PointerEvent) => {
    if (!canvasRef.current || !layoutForm) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const el = layoutForm.label_canvas_elements.find(x => x.id === id);
    if (!el) return;
    dragState.current = {
      id, mode: 'move',
      startX: e.clientX, startY: e.clientY,
      origX: el.x, origY: el.y, origRot: el.rotation,
      origWidth: el.width,
      labelW: rect.width, labelH: rect.height,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [layoutForm]);

  const handleElementResizeStart = useCallback((id: LabelSectionId, side: 'left' | 'right', e: React.PointerEvent) => {
    if (!canvasRef.current || !layoutForm) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const el = layoutForm.label_canvas_elements.find(x => x.id === id);
    if (!el) return;
    dragState.current = {
      id, mode: side === 'left' ? 'resize-left' : 'resize-right',
      startX: e.clientX, startY: e.clientY,
      origX: el.x, origY: el.y, origRot: el.rotation,
      origWidth: el.width,
      labelW: rect.width, labelH: rect.height,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [layoutForm]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;

    if (ds.mode === 'move') {
      const newX = Math.max(2, Math.min(98, ds.origX + (dx / ds.labelW) * 100));
      const newY = Math.max(2, Math.min(98, ds.origY + (dy / ds.labelH) * 100));
      updateElement(ds.id, { x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 });
    } else {
      // Project drag delta onto the element's local horizontal axis (accounts for rotation)
      const rotRad = (ds.origRot * Math.PI) / 180;
      const projPx = dx * Math.cos(rotRad) + dy * Math.sin(rotRad);
      const projPct = (projPx / ds.labelW) * 100;

      const MIN_W = 10, MAX_W = 96;

      if (ds.mode === 'resize-right') {
        // Right edge moves → width grows, center drifts right by Δw/2
        const newW = Math.max(MIN_W, Math.min(MAX_W, ds.origWidth + projPct));
        const delta = newW - ds.origWidth; // actual clamped delta in %
        const newX = Math.max(2, Math.min(98, ds.origX + (delta / 2) * Math.cos(rotRad)));
        const newY = Math.max(2, Math.min(98, ds.origY + (delta / 2) * Math.sin(rotRad) * (ds.labelW / ds.labelH)));
        updateElement(ds.id, {
          width: Math.round(newW * 10) / 10,
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
        });
      } else {
        // Left edge moves → width grows when dragged left, center drifts left by Δw/2
        const newW = Math.max(MIN_W, Math.min(MAX_W, ds.origWidth - projPct));
        const delta = newW - ds.origWidth;
        const newX = Math.max(2, Math.min(98, ds.origX - (delta / 2) * Math.cos(rotRad)));
        const newY = Math.max(2, Math.min(98, ds.origY - (delta / 2) * Math.sin(rotRad) * (ds.labelW / ds.labelH)));
        updateElement(ds.id, {
          width: Math.round(newW * 10) / 10,
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
        });
      }
    }
  }, [updateElement]);

  const handleCanvasPointerUp = useCallback(() => { dragState.current = null; }, []);

  const saveLayout = useCallback(async () => {
    if (!store || !layoutForm) return;
    setSavingLayout(true);
    try {
      const payload: LabelLayoutPatch = {
        ...layoutForm,
        label_canvas_elements: layoutForm.label_canvas_elements,
        label_height_mm: layoutForm.label_height_mm,
      };
      const updated = await storeService.patchLabelLayout(store.store_id, payload);
      setStore(updated);
      setLayoutForm(labelFormFromStore(updated));
      toast.success('Label layout saved');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message : null;
      toast.error(msg || 'Could not save label settings');
    } finally { setSavingLayout(false); }
  }, [store, layoutForm]);

  const resetLayout = useCallback(() => { if (store) setLayoutForm(labelFormFromStore(store)); }, [store]);

  const resetElementPositions = useCallback(() => {
    setLayoutForm(prev => prev ? { ...prev, label_canvas_elements: DEFAULT_CANVAS_ELEMENTS.map(e => ({ ...e })) } : prev);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => { setSearchQuery(value); setCurrentPage(1); }, 400);
  }, []);

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setSelectedProductDetails(prev => {
      const n = new Map(prev);
      if (n.has(id)) { n.delete(id); } else { const p = products.find(x => x.product_id === id); if (p) n.set(id, p); }
      return n;
    });
  }, [products]);

  const allOnPageSelected = products.length > 0 && products.every(p => selected.has(p.product_id));

  const toggleAll = useCallback(() => {
    if (allOnPageSelected) {
      setSelected(prev => { const n = new Set(prev); products.forEach(p => n.delete(p.product_id)); return n; });
      setSelectedProductDetails(prev => { const n = new Map(prev); products.forEach(p => n.delete(p.product_id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); products.forEach(p => n.add(p.product_id)); return n; });
      setSelectedProductDetails(prev => { const n = new Map(prev); products.forEach(p => n.set(p.product_id, p)); return n; });
    }
  }, [products, allOnPageSelected]);

  const selectedProducts = Array.from(selectedProductDetails.values());

  const pageNumbers: (number | '...')[] = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(2, currentPage - 2), end = Math.min(totalPages - 1, currentPage + 2);
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
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Please allow pop-ups to print.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Labels</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;}@media print{html,body{width:100%;height:100%;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:0;}}</style></head><body>${html}</body></html>`);
    win.document.close(); win.focus();
    // win.print() runs on the popup (not covered by the global window.print
    // patch) and closing the popup triggers the same Windows keyboard-freeze
    // bug on the main window — restore input focus explicitly.
    const printWhenReady = () => { setTimeout(() => { win.print(); win.close(); restoreInputFocus(); }, 120); };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((win.document as any).fonts) { (win.document as any).fonts.ready.then(printWhenReady); }
    else { setTimeout(printWhenReady, 900); }
  }, []);

  const paper    = store ? getPaperDims(store.paper_size) : PAPER_PRESETS['A4']!;
  const cols     = calcGrid(paper.widthMM);
  const currency = store?.currency_code || 'USD';

  const editorProductName = selectedProducts[0]?.name ?? products[0]?.name ?? 'Product Name';
  const editorPrice = Number(selectedProducts[0]?.sale_price ?? selectedProducts[0]?.list_price ?? products[0]?.sale_price ?? products[0]?.list_price ?? 9.99);
  const editorBarcode = selectedProducts[0]?.barcode ?? products[0]?.barcode ?? '1234567890';

  const CAROUSEL_VISIBLE = 4;
  const CAROUSEL_SCALE   = 0.85;
  const scaledLabelW = layoutForm ? Math.round(mmToPx(LABEL_W_MM) * CAROUSEL_SCALE) : 0;
  const scaledLabelH = layoutForm ? Math.round(mmToPx(layoutForm.label_height_mm) * CAROUSEL_SCALE) : 0;
  const visibleCarouselLabels = selectedProducts.slice(carouselOffset, carouselOffset + CAROUSEL_VISIBLE);
  const canCarouselLeft  = carouselOffset > 0;
  const canCarouselRight = carouselOffset + CAROUSEL_VISIBLE < selectedProducts.length;

  const activeEl = layoutForm?.label_canvas_elements.find(e => e.id === activeElement) ?? null;

  return (
    <div className="flex flex-col h-full overflow-x-hidden">

      <div className="px-3">
        <PageBanner
          title="Labels"
          subtitle={store?.ui_resolution === '1024x768' ? `${cols} labels/row` : `${paper.label} · ${cols} labels/row · ${LABEL_W_MM}×${layoutForm?.label_height_mm ?? DEFAULT_H_MM}mm`}
          icon={<TagIcon className="w-5 h-5 text-white" />}
          action={
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-xs font-medium text-white/70 bg-white/10 border border-white/20 rounded-full px-3 py-1">
                {selected.size} selected
              </span>
              <Button id="btn-preview-labels" disabled={selected.size === 0} onClick={() => setShowPreview(true)} size="sm" variant="primary"
                className="bg-white/20 hover:bg-white/30 text-white border-white/20 shadow-none" leftIcon={<EyeIcon className="w-4 h-4" />}>
                Preview
              </Button>
            </div>
          }
        />
      </div>

      {/* Tabs */}
      <div className="px-3 mb-4">
        <div className="bg-white p-1 rounded-2xl border border-gray-200 shadow-soft flex items-center gap-1">
          {(['shelf', 'promotion'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === tab ? 'bg-secondary-600 text-white shadow-brand' : 'text-gray-500 hover:bg-gray-50'}`}>
              {tab === 'shelf' ? <><TagIcon className="w-4 h-4" />Shelf Label</> : <><PaintBrushIcon className="w-4 h-4" />Promotion Label</>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* ── Shelf Label Designer ── */}
        {activeTab === 'shelf' && canEditLayout && layoutForm && (
          <div className="px-3 pt-3 pb-4 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-soft overflow-hidden">
              {/* Collapsible header */}
              <button type="button" onClick={() => setLayoutOpen(!layoutOpen)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary-50 flex items-center justify-center">
                    <PaintBrushIcon className="w-4 h-4 text-secondary-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">Label Designer</p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mt-0.5">Drag elements · Resize · Rotate · Configure</p>
                  </div>
                </div>
                <div className={`transition-transform duration-200 ${layoutOpen ? 'rotate-180' : ''}`}>
                  <ChevronLeftIcon className="w-5 h-5 text-gray-400 -rotate-90" />
                </div>
              </button>

              {layoutOpen && (
                <div className="p-5 bg-white">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* LEFT: controls */}
                    <div className="lg:col-span-5 space-y-4">

                      {/* Label height */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Label Height</p>
                        <div className="flex items-center gap-3">
                          <input type="range" min={MIN_H_MM} max={MAX_H_MM} step={1}
                            value={layoutForm.label_height_mm}
                            onChange={e => setField('label_height_mm', parseInt(e.target.value, 10))}
                            className="flex-1 h-1.5 appearance-none bg-gray-200 rounded-full outline-none cursor-pointer"
                            style={{ accentColor: '#3582e2' }} />
                          <span className="text-xs font-bold text-secondary-700 tabular-nums bg-secondary-50 px-2 py-1 rounded-lg border border-secondary-100 min-w-[48px] text-center">
                            {layoutForm.label_height_mm}mm
                          </span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[10px] text-gray-400">{MIN_H_MM}mm</span>
                          <span className="text-[10px] text-gray-400">{MAX_H_MM}mm</span>
                        </div>
                      </div>

                      {/* Element visibility toggles */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Show / Hide Elements</p>
                        <div className="space-y-2">
                          {SECTION_META.map(meta => {
                            const el = layoutForm.label_canvas_elements.find(e => e.id === meta.id);
                            if (!el) return null;
                            const isActive = activeElement === meta.id;
                            return (
                              <button key={meta.id} type="button"
                                onClick={() => setActiveElement(isActive ? null : meta.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left ${
                                  isActive ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'
                                }`}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                                  <span className="text-xs font-semibold text-gray-700">{meta.label}</span>
                                </div>
                                <div
                                  className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${el.visible ? 'bg-secondary-500' : 'bg-gray-300'}`}
                                  onClick={(e) => { e.stopPropagation(); updateElement(meta.id, { visible: !el.visible }); }}
                                >
                                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${el.visible ? 'left-[18px]' : 'left-0.5'}`} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Selected element controls */}
                      {activeElement && activeEl && (
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 space-y-4">
                          <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: SECTION_META.find(m => m.id === activeElement)?.color }} />
                            <p className="text-xs font-bold text-blue-900">{SECTION_META.find(m => m.id === activeElement)?.label}</p>
                          </div>

                          <ControlRow label="Width">
                            <div className="flex items-center gap-3">
                              <input type="range" min={10} max={96} step={1}
                                value={activeEl.width}
                                onChange={e => updateElement(activeElement, { width: parseInt(e.target.value, 10) })}
                                className="flex-1 h-1.5 appearance-none bg-blue-200 rounded-full outline-none cursor-pointer"
                                style={{ accentColor: '#3b82f6' }} />
                              <span className="text-xs font-bold text-blue-700 tabular-nums bg-white px-2 py-1 rounded-lg border border-blue-200 min-w-[44px] text-center">
                                {activeEl.width}%
                              </span>
                            </div>
                          </ControlRow>

                          <ControlRow label="Scale">
                            <div className="flex items-center gap-3">
                              <input type="range" min={0.3} max={3} step={0.05}
                                value={activeEl.scale}
                                onChange={e => updateElement(activeElement, { scale: parseFloat(e.target.value) })}
                                className="flex-1 h-1.5 appearance-none bg-blue-200 rounded-full outline-none cursor-pointer"
                                style={{ accentColor: '#3b82f6' }} />
                              <span className="text-xs font-bold text-blue-700 tabular-nums bg-white px-2 py-1 rounded-lg border border-blue-200 min-w-[44px] text-center">
                                {activeEl.scale.toFixed(2)}×
                              </span>
                            </div>
                          </ControlRow>

                          <ControlRow label="Rotation">
                            <div className="flex items-center gap-3">
                              <input type="range" min={-180} max={180} step={1}
                                value={activeEl.rotation}
                                onChange={e => updateElement(activeElement, { rotation: parseInt(e.target.value, 10) })}
                                className="flex-1 h-1.5 appearance-none bg-blue-200 rounded-full outline-none cursor-pointer"
                                style={{ accentColor: '#3b82f6' }} />
                              <span className="text-xs font-bold text-blue-700 tabular-nums bg-white px-2 py-1 rounded-lg border border-blue-200 min-w-[44px] text-center">
                                {activeEl.rotation}°
                              </span>
                            </div>
                          </ControlRow>

                          {/* Typography controls per section */}
                          {activeElement === 'header' && (
                            <div className="space-y-3 pt-2 border-t border-blue-200">
                              <ControlRow label="Font Size">
                                <SizeSlider value={layoutForm.label_store_name_size} min={3} max={18} fallback={5.5} onChange={v => setField('label_store_name_size', v)} />
                              </ControlRow>
                              <ControlRow label="Font Weight">
                                <WeightGrid value={layoutForm.label_header_font_weight} onChange={v => setField('label_header_font_weight', v)} />
                              </ControlRow>
                              <ControlRow label="Alignment">
                                <AlignSegment value={layoutForm.label_header_align} onChange={v => setField('label_header_align', v as 'left' | 'center' | 'right')} options={[{ value: 'left', label: 'L' }, { value: 'center', label: 'C' }, { value: 'right', label: 'R' }]} />
                              </ControlRow>
                            </div>
                          )}
                          {activeElement === 'title' && (
                            <div className="space-y-3 pt-2 border-t border-blue-200">
                              <ControlRow label="Font Size">
                                <SizeSlider value={layoutForm.label_product_name_size} min={6} max={36} fallback={15} onChange={v => setField('label_product_name_size', v)} />
                              </ControlRow>
                              <ControlRow label="Font Weight">
                                <WeightGrid value={layoutForm.label_title_font_weight} onChange={v => setField('label_title_font_weight', v)} />
                              </ControlRow>
                            </div>
                          )}
                          {activeElement === 'lbp' && (
                            <div className="space-y-3 pt-2 border-t border-blue-200">
                              <button type="button" onClick={() => setField('label_show_lbp', !layoutForm.label_show_lbp)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${layoutForm.label_show_lbp ? 'bg-secondary-50 border-secondary-200' : 'bg-gray-50 border-gray-200'}`}>
                                <span className="text-xs font-semibold text-gray-700">Show LBP line</span>
                                <div className={`w-9 h-5 rounded-full transition-colors relative ${layoutForm.label_show_lbp ? 'bg-secondary-500' : 'bg-gray-300'}`}>
                                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${layoutForm.label_show_lbp ? 'left-[18px]' : 'left-0.5'}`} />
                                </div>
                              </button>
                              <ControlRow label="Amount Size">
                                <SizeSlider value={layoutForm.label_lbp_size} min={6} max={36} fallback={14} onChange={v => setField('label_lbp_size', v)} />
                              </ControlRow>
                            </div>
                          )}
                          {activeElement === 'price' && (
                            <div className="space-y-3 pt-2 border-t border-blue-200">
                              <ControlRow label="Price Size">
                                <SizeSlider value={layoutForm.label_price_size} min={8} max={52} fallback={30} onChange={v => setField('label_price_size', v)} />
                              </ControlRow>
                              <ControlRow label="Currency Size">
                                <SizeSlider value={layoutForm.label_currency_size} min={4} max={24} fallback={11} onChange={v => setField('label_currency_size', v)} />
                              </ControlRow>
                              <ControlRow label="Font Weight">
                                <WeightGrid value={layoutForm.label_price_amount_weight} onChange={v => setField('label_price_amount_weight', v)} />
                              </ControlRow>
                            </div>
                          )}
                          {activeElement === 'barcode' && (
                            <div className="space-y-3 pt-2 border-t border-blue-200">
                              <button type="button" onClick={() => setField('label_show_barcode', !layoutForm.label_show_barcode)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${layoutForm.label_show_barcode ? 'bg-secondary-50 border-secondary-200' : 'bg-gray-50 border-gray-200'}`}>
                                <span className="text-xs font-semibold text-gray-700">Show Barcode</span>
                                <div className={`w-9 h-5 rounded-full transition-colors relative ${layoutForm.label_show_barcode ? 'bg-secondary-500' : 'bg-gray-300'}`}>
                                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${layoutForm.label_show_barcode ? 'left-[18px]' : 'left-0.5'}`} />
                                </div>
                              </button>
                              <ControlRow label="Bar Height">
                                <SizeSlider value={layoutForm.label_barcode_height} min={10} max={36} step={1} fallback={22} onChange={v => setField('label_barcode_height', v)} />
                              </ControlRow>
                            </div>
                          )}

                          <button type="button" onClick={() => {
                            const def = DEFAULT_CANVAS_ELEMENTS.find(d => d.id === activeElement);
                            updateElement(activeElement, { rotation: 0, scale: 1, width: def?.width ?? 88 });
                          }}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors">
                            <ArrowPathIcon className="w-3 h-3" />
                            Reset width, scale & rotation
                          </button>
                        </div>
                      )}
                    </div>

                    {/* RIGHT: canvas preview */}
                    <div className="lg:col-span-7 flex flex-col items-center">
                      <div className="flex items-center justify-between w-full mb-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Canvas — drag to reposition</p>
                        <button type="button" onClick={resetElementPositions}
                          className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-secondary-600 transition-colors">
                          <ArrowsPointingOutIcon className="w-3.5 h-3.5" />
                          Reset layout
                        </button>
                      </div>

                      {/* The canvas */}
                      <div
                        ref={canvasRef}
                        className="relative bg-white border-2 border-dashed border-gray-200 rounded-lg"
                        style={{
                          width: mmToPx(LABEL_W_MM),
                          height: mmToPx(layoutForm.label_height_mm),
                          overflow: 'hidden',
                        }}
                        onPointerMove={handleCanvasPointerMove}
                        onPointerUp={handleCanvasPointerUp}
                        onPointerLeave={handleCanvasPointerUp}
                        onClick={() => setActiveElement(null)}
                      >
                        {displayStore && (
                          <CanvasLabel
                            storeName={displayStore.name ?? ''}
                            productName={editorProductName}
                            price={editorPrice}
                            currency={currency}
                            barcode={editorBarcode}
                            store={displayStore}
                            form={layoutForm}
                            interactive
                            activeElement={activeElement}
                            onElementSelect={setActiveElement}
                            onElementDragStart={handleElementDragStart}
                            onElementResizeStart={handleElementResizeStart}
                            style={{ width: '100%', height: '100%', border: 'none', borderRadius: 0 }}
                          />
                        )}
                      </div>

                      <p className="mt-2 text-[9px] text-gray-400 text-center">
                        Click element to select · Drag to move · Use sliders for scale & rotation
                      </p>

                      {/* Section labels legend */}
                      <div className="mt-4 flex flex-wrap gap-2 justify-center">
                        {SECTION_META.map(meta => {
                          const el = layoutForm.label_canvas_elements.find(e => e.id === meta.id);
                          return (
                            <button key={meta.id} type="button"
                              onClick={() => setActiveElement(activeElement === meta.id ? null : meta.id)}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                                !el?.visible ? 'opacity-40 bg-gray-50 border-gray-200 text-gray-400' :
                                activeElement === meta.id ? 'bg-blue-500 text-white border-blue-500' :
                                'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                              }`}>
                              <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between">
                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                      Changes affect all printed labels
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={resetLayout} disabled={savingLayout}
                        className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                        Discard
                      </button>
                      <button type="button" onClick={() => void saveLayout()} disabled={savingLayout}
                        className="px-6 py-2 text-xs font-bold text-white bg-secondary-600 rounded-xl hover:bg-secondary-700 disabled:opacity-50 transition-colors shadow-lg">
                        {savingLayout ? 'Saving…' : 'Save layout'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Promotion tab options ── */}
        {activeTab === 'promotion' && (
          <div className="px-3 pb-4 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-soft p-4 flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 ml-1">Promotion Text</label>
                <div className="relative">
                  <PaintBrushIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={promoText} onChange={e => setPromoText(e.target.value.toUpperCase())} className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-secondary-500 transition-all font-bold text-red-600" placeholder="WEEKEND FRENZY!" />
                </div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 ml-1">Product Origin</label>
                <div className="relative">
                  <BuildingOfficeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={promoOrigin} onChange={e => setPromoOrigin(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-secondary-500 transition-all font-medium text-gray-700" placeholder="Product of Australia" />
                </div>
              </div>
              <div className="flex-shrink-0">
                <Button onClick={() => setShowPreview(true)} disabled={selected.size === 0} variant="primary" size="sm" className="bg-secondary-600 hover:bg-secondary-700 h-[42px] px-6 rounded-xl shadow-lg transition-all" leftIcon={<PrinterIcon className="w-5 h-5" />}>Generate Posters</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Content area ── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Shelf label carousel */}
          {activeTab === 'shelf' && layoutForm && (
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCarouselOffset(o => Math.max(0, o - 1))} disabled={!canCarouselLeft}
                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-25 bg-white shadow-sm">
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <div className="flex-1 flex items-center justify-center gap-2 min-w-0 overflow-hidden" style={{ height: scaledLabelH + 4 }}>
                  {selectedProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center w-full gap-1.5">
                      <TagIcon className="w-6 h-6 text-gray-300" />
                      <p className="text-sm font-semibold text-gray-400">No selection</p>
                    </div>
                  ) : (
                    visibleCarouselLabels.map(p => (
                      <div key={p.product_id} style={{ width: scaledLabelW, height: scaledLabelH, flexShrink: 0, overflow: 'hidden', borderRadius: 4 }}>
                        <div style={{ transform: `scale(${CAROUSEL_SCALE})`, transformOrigin: 'top left', width: mmToPx(LABEL_W_MM), height: mmToPx(layoutForm.label_height_mm) }}>
                          {displayStore && (
                            <StaticLabel storeName={displayStore.name ?? ''} productName={p.name}
                              price={Number(p.sale_price ?? p.list_price ?? 0)} currency={currency}
                              barcode={p.barcode} store={displayStore} form={layoutForm} />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button type="button" onClick={() => setCarouselOffset(o => Math.min(o + 1, Math.max(0, selectedProducts.length - CAROUSEL_VISIBLE)))} disabled={!canCarouselRight}
                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-25 bg-white shadow-sm">
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Promotion preview */}
          {activeTab === 'promotion' && (
            <div className="flex-shrink-0 bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex flex-col items-center justify-center overflow-auto border-b border-gray-200">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Poster Preview</p>
              {selected.size > 0 ? (
                <div className="relative shadow-2xl scale-[0.3] origin-center -my-[350px]">
                  <PromotionCard storeName={store?.name ?? 'STORE NAME'} productName={selectedProducts[0]?.name ?? 'PRODUCT NAME'} price={selectedProducts[0]?.sale_price ?? selectedProducts[0]?.list_price ?? 0} unit={selectedProducts[0]?.unit_of_measure || 'kilo'} origin={promoOrigin} promoText={promoText} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 opacity-30 text-center">
                  <TagIcon className="w-10 h-10 mb-2" />
                  <p className="text-sm font-bold">Select products to preview poster</p>
                </div>
              )}
            </div>
          )}

          {/* Product List */}
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="labels-search" type="text" placeholder="Search products..." value={search}
                  onChange={e => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 outline-none" />
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-8 h-8 border-4 border-secondary-200 border-t-secondary-600 rounded-full animate-spin" />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 z-10">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <button onClick={toggleAll} className={`w-5 h-5 rounded border-2 flex items-center justify-center ${allOnPageSelected ? 'bg-secondary-600 border-secondary-600' : 'border-gray-300'}`}>
                          {allOnPageSelected && <CheckIcon className="w-3 h-3 text-white" />}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Product</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">SKU / Barcode</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No products found</td></tr>
                    ) : products.map(p => {
                      const isSel = selected.has(p.product_id);
                      return (
                        <tr key={p.product_id} onClick={() => toggleOne(p.product_id)}
                          className={`cursor-pointer transition-colors ${isSel ? 'bg-secondary-50' : 'hover:bg-gray-50'}`}>
                          <td className="px-4 py-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSel ? 'bg-secondary-600 border-secondary-600' : 'border-gray-300'}`}>
                              {isSel && <CheckIcon className="w-3 h-3 text-white" />}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono">{p.barcode || p.sku || '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">{currency} {Number(p.sale_price ?? p.list_price ?? 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {totalPages > 1 && (
              <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between text-sm flex-shrink-0">
                <span className="text-gray-500 text-xs">{totalProducts === 0 ? 'No products' : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, totalProducts)} of ${totalProducts}`}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30">‹</button>
                  {pageNumbers.map((n, i) => n === '...' ? <span key={`e-${i}`} className="px-1 text-gray-400 text-xs">…</span> :
                    <button key={n} onClick={() => setCurrentPage(n as number)} className={`w-7 h-7 rounded text-xs font-medium ${n === currentPage ? 'bg-secondary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{n}</button>
                  )}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30">›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print Preview modal */}
      {showPreview && store && layoutForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary-50 flex items-center justify-center flex-shrink-0">
                  <PrinterIcon className="w-4 h-4 text-secondary-600" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm leading-tight">Print Preview</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedProducts.length} label{selectedProducts.length !== 1 ? 's' : ''} · {paper.label} · {cols} per row</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-6">
                <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-secondary-600 text-white rounded-lg text-sm font-semibold hover:bg-secondary-700 shadow-sm">
                  <PrinterIcon className="w-4 h-4" />Print
                </button>
                <button onClick={() => setShowPreview(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-auto bg-gray-100 p-6 flex-1">
              <div ref={printRef} className="shadow-lg mx-auto" style={{ width: 'fit-content' }}>
                {activeTab === 'shelf'
                  ? <PrintPreview products={selectedProducts} store={store} form={layoutForm} />
                  : <PromotionPrintPreview products={selectedProducts} store={store} promoText={promoText} origin={promoOrigin} />
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
