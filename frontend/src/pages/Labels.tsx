import { useState, useEffect, useRef, useCallback } from 'react';
import { productService, Product } from '../services/productService';
import { storeService, StoreSettings } from '../services/storeService';
import {
  TagIcon,
  PrinterIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

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

// ─── Label card (single label) ───────────────────────────────────────────────
interface LabelCardProps {
  storeName: string;
  productName: string;
  price: number;
  currency: string;
  style?: React.CSSProperties;
}

function LabelCard({ storeName, productName, price, currency, style }: LabelCardProps) {
  return (
    <div
      className="label-card"
      style={{
        width:       mmToPx(LABEL_W_MM),
        height:      mmToPx(LABEL_H_MM),
        border:      '1.5px solid #222',
        borderRadius: 5,
        display:     'flex',
        flexDirection: 'column',
        alignItems:  'center',
        background:  '#ffffff',
        boxSizing:   'border-box',
        overflow:    'hidden',
        fontFamily:  'Arial, Helvetica, sans-serif',
        ...style,
      }}
    >
      {/* ── Top strip: store name ── */}
      <div style={{
        width: '100%',
        background: '#111',
        textAlign: 'center',
        padding: '3px 6px',
        boxSizing: 'border-box',
      }}>
        <span style={{
          fontSize: 6.5,
          fontWeight: 700,
          color: '#ffffff',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'block',
        }}>
          {storeName}
        </span>
      </div>

      {/* ── Middle: product name (centered, wraps) ── */}
      <div style={{
        flex: 1,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 8px',
        boxSizing: 'border-box',
      }}>
        <span style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: '#111',
          textAlign: 'center',
          lineHeight: 1.35,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {productName}
        </span>
      </div>

      {/* ── Thin divider ── */}
      <div style={{ width: '80%', height: 1, background: '#ddd', marginBottom: 3 }} />

      {/* ── Bottom: price ── */}
      <div style={{
        width: '100%',
        textAlign: 'center',
        padding: '2px 6px 5px',
        boxSizing: 'border-box',
      }}>
        <span style={{
          fontSize: 15,
          fontWeight: 900,
          color: '#111',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          {currency} {Number(price).toFixed(2)}
        </span>
      </div>
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

  // Chunk products into rows
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
              style={{ width: labelWPx, height: labelHPx, flexShrink: 0 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Main Labels page ─────────────────────────────────────────────────────────
export default function Labels() {
  const [products,     setProducts]     = useState<Product[]>([]);
  const [store,        setStore]        = useState<StoreSettings | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [showPreview,  setShowPreview]  = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Load data
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
        setProducts(prodData.data);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Filtered list
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode ?? '').includes(search) ||
    (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // Selection helpers
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

  // Selected products in order
  const selectedProducts = products.filter(p => selected.has(p.product_id));

  // Print handler – opens native print dialog scoped to the preview div
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

  return (
    <div className="h-full flex flex-col space-y-5">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
            <TagIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Shelf Labels</h1>
            <p className="text-xs text-gray-500">
              {paper.label} · {cols} label{cols !== 1 ? 's' : ''} per row · {LABEL_W_MM}×{LABEL_H_MM} mm each
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 bg-gray-100 rounded-full px-3 py-1">
            {selected.size} selected
          </span>
          <button
            id="btn-preview-labels"
            disabled={selected.size === 0}
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm font-semibold hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <EyeIcon className="w-4 h-4" />
            Preview
          </button>
          <button
            id="btn-print-labels"
            disabled={selected.size === 0}
            onClick={() => { setShowPreview(true); setTimeout(handlePrint, 100); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            <PrinterIcon className="w-4 h-4" />
            Print Labels
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex gap-5 flex-1 min-h-0">

        {/* Left: Product selection table */}
        <div className="flex-1 min-w-0 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Search bar */}
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="labels-search"
                type="text"
                placeholder="Search products by name, SKU or barcode…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
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
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-gray-300 hover:border-indigo-400'
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
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-3">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600'
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

        {/* Right: Mini live preview */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Label Preview</p>
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 overflow-auto flex flex-col gap-2">
            {selectedProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center mt-10">Select products to preview labels</p>
            ) : (
              selectedProducts.slice(0, 12).map(p => (
                <LabelCard
                  key={p.product_id}
                  storeName={store?.name ?? ''}
                  productName={p.name}
                  price={p.sale_price ?? p.list_price ?? 0}
                  currency={currency}
                />
              ))
            )}
            {selectedProducts.length > 12 && (
              <p className="text-xs text-gray-400 text-center">+{selectedProducts.length - 12} more…</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Print Preview Modal ──────────────────────────────────── */}
      {showPreview && store && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-auto py-8 px-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-fit" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-base">Print Preview — {selectedProducts.length} label{selectedProducts.length !== 1 ? 's' : ''}</h2>
              <div className="flex items-center gap-2">
                <button
                  id="modal-print-labels"
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <PrinterIcon className="w-4 h-4" />
                  Print
                </button>
                <button
                  id="modal-close-preview"
                  onClick={() => setShowPreview(false)}
                  className="px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100 text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Preview content */}
            <div className="p-6 overflow-auto max-h-[75vh] bg-gray-100">
              <div ref={printRef} className="shadow-lg">
                <PrintPreview products={selectedProducts} store={store} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
