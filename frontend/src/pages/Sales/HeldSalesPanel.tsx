import { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, ArrowPathIcon, TrashIcon, ClockIcon, ShoppingCartIcon, PauseCircleIcon } from '@heroicons/react/24/outline';
import { LocalSale } from '../../hooks/useSaleSessions';

interface HeldSalesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  heldSales: LocalSale[];
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  currency: string;
  /** Ref to the button that toggles this panel — used for portal positioning */
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function HeldSalesPanel({
  isOpen,
  onClose,
  heldSales,
  onResume,
  onDelete,
  currency,
  anchorRef,
}: HeldSalesPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Portal position state ─────────────────────────────────────────────────
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  // Calculate position from anchor button on every open
  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,           // 6px gap below the button
      right: window.innerWidth - rect.right, // align right edge to button right
    });
  }, [isOpen, anchorRef]);

  // Re-calculate on scroll/resize so the panel follows the anchor
  useEffect(() => {
    if (!isOpen) return;
    const recalc = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    };
    window.addEventListener('scroll', recalc, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', recalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [isOpen, anchorRef]);

  // ── Outside click → close ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      // Ignore clicks inside the panel or on the anchor button itself
      if (
        panelRef.current?.contains(e.target as Node) ||
        anchorRef.current?.contains(e.target as Node)
      ) return;
      onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [isOpen, onClose, anchorRef]);

  // ── Escape → close ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !pos) return null;

  return createPortal(
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] md:hidden"
        onClick={onClose}
      />

      {/* Panel — fixed to viewport, z-50, never clipped by parent overflow */}
      <div
        ref={panelRef}
        className="fixed z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        style={{ top: pos.top, right: pos.right, animation: 'heldPanelIn 0.18s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <PauseCircleIcon className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-gray-800">Held Sales</span>
            <span className="text-xs bg-amber-100 text-amber-700 font-bold rounded-full px-2 py-0.5">
              {heldSales.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
          {heldSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <ShoppingCartIcon className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm font-medium">No held sales</p>
            </div>
          ) : (
            heldSales.map((sale) => {
              const itemCount = sale.items.reduce((s, i) => s + i.qty, 0);
              return (
                <div
                  key={sale.id}
                  className="px-4 py-3 hover:bg-amber-50 transition-colors group"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate font-mono">
                        #{sale.id.slice(-8).toUpperCase()}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <ClockIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="text-[10px] text-gray-400">
                          {timeAgo(sale.createdAt)}
                        </span>
                        {sale.customer && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-[10px] text-gray-500 truncate">
                              {sale.customer.full_name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Total */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">
                        {currency} {sale.total.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {itemCount.toFixed(3).replace(/\.?0+$/, '')} item{itemCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Item preview */}
                  {sale.items.length > 0 && (
                    <p className="text-[10px] text-gray-400 truncate mb-2">
                      {sale.items.slice(0, 3).map(i => i.product.name).join(', ')}
                      {sale.items.length > 3 && ` +${sale.items.length - 3} more`}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      id={`resume-sale-${sale.id}`}
                      onClick={() => { onResume(sale.id); onClose(); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 hover:border-green-400 transition-colors"
                    >
                      <ArrowPathIcon className="w-3.5 h-3.5" />
                      Resume
                    </button>
                    <button
                      id={`delete-held-sale-${sale.id}`}
                      onClick={() => onDelete(sale.id)}
                      className="w-8 h-7 flex items-center justify-center rounded-lg text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 hover:border-red-300 transition-colors"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-[10px] text-gray-400 text-center">
            Held sales are stored locally and survive page refreshes
          </p>
        </div>
      </div>

      <style>{`
        @keyframes heldPanelIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>,
    document.body
  );
}
