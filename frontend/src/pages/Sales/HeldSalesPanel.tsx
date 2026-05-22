import { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  XMarkIcon,
  ArrowPathIcon,
  TrashIcon,
  ClockIcon,
  ShoppingBagIcon,
  PauseCircleIcon,
  UserIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { LocalSale } from '../../hooks/useSaleSessions';

interface HeldSalesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  heldSales: LocalSale[];
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  currency: string;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (!isOpen) return;
    const recalc = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    };
    window.addEventListener('scroll', recalc, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', recalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
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

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Reset confirm state when panel closes or list changes
  useEffect(() => {
    if (!isOpen) setConfirmDelete(null);
  }, [isOpen]);

  if (!isOpen || !pos) return null;

  return createPortal(
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[1px] md:hidden"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="fixed z-[9999] w-[26rem] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
        style={{ top: pos.top, right: pos.right, maxHeight: 'calc(100vh - 120px)', animation: 'heldPanelIn 0.15s ease-out' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-secondary-50 to-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-secondary-100 rounded-lg">
              <PauseCircleIcon className="w-4 h-4 text-secondary-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">Held Invoices</p>
              <p className="text-[10px] text-gray-400 leading-tight">
                {heldSales.length === 0
                  ? 'No held invoices'
                  : `${heldSales.length} invoice${heldSales.length !== 1 ? 's' : ''} waiting`}
              </p>
            </div>
            {heldSales.length > 0 && (
              <span className="ml-1 min-w-[22px] h-5 bg-secondary-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5">
                {heldSales.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* ── List ── */}
        <div className="overflow-y-auto flex-1">
          {heldSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                <ShoppingBagIcon className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-500">No held invoices</p>
              <p className="text-xs text-gray-400 mt-1">
                Hold a sale to pause it and start a new one
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1.5">
              {heldSales.map((sale, index) => {
                const itemCount = sale.items.reduce((s, i) => s + i.qty, 0);
                const isConfirming = confirmDelete === sale.id;
                return (
                  <div
                    key={sale.id}
                    className="rounded-xl border border-gray-100 bg-white hover:border-secondary-100 hover:bg-secondary-50/30 transition-all group overflow-hidden"
                  >
                    {/* Card top: invoice # + total */}
                    <div className="flex items-start justify-between px-3.5 pt-3 pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-secondary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-black text-secondary-700">#{index + 1}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 font-mono tracking-wide leading-tight">
                            INV-{sale.id.slice(-6).toUpperCase()}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <ClockIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-[10px] text-gray-400">
                              {formatTime(sale.createdAt)} · {timeAgo(sale.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Total */}
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-sm font-black text-gray-900 tabular-nums">
                          {currency} {sale.total.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-gray-400 text-right">
                          {itemCount.toFixed(3).replace(/\.?0+$/, '')} {itemCount === 1 ? 'unit' : 'units'}
                        </p>
                      </div>
                    </div>

                    {/* Customer row */}
                    {sale.customer && (
                      <div className="flex items-center gap-1.5 px-3.5 pb-1.5">
                        <UserIcon className="w-3 h-3 text-secondary-400 flex-shrink-0" />
                        <span className="text-[11px] font-medium text-secondary-700 truncate">
                          {sale.customer.full_name}
                        </span>
                      </div>
                    )}

                    {/* Item chips */}
                    {sale.items.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-3.5 pb-2.5">
                        {sale.items.slice(0, 4).map((item, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-600 font-medium max-w-[120px]"
                          >
                            <TagIcon className="w-2.5 h-2.5 flex-shrink-0 text-gray-400" />
                            <span className="truncate">{item.product.name}</span>
                            {item.qty !== 1 && (
                              <span className="text-gray-400 font-normal">×{item.qty.toFixed(3).replace(/\.?0+$/, '')}</span>
                            )}
                          </span>
                        ))}
                        {sale.items.length > 4 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary-50 text-[10px] text-secondary-600 font-semibold">
                            +{sale.items.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action row */}
                    <div className="flex gap-1.5 px-3.5 pb-3">
                      {isConfirming ? (
                        <>
                          <span className="flex-1 text-[11px] text-red-600 font-medium flex items-center">
                            Remove this invoice?
                          </span>
                          <button
                            onClick={() => { onDelete(sale.id); setConfirmDelete(null); }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            id={`resume-sale-${sale.id}`}
                            onClick={() => { onResume(sale.id); onClose(); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-secondary-500 text-white hover:bg-secondary-600 transition-colors shadow-sm"
                          >
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                            Resume
                          </button>
                          <button
                            id={`delete-held-sale-${sale.id}`}
                            onClick={() => setConfirmDelete(sale.id)}
                            className="w-8 h-7 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 border border-gray-200 hover:border-red-200 transition-colors"
                            title="Remove held invoice"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <p className="text-[10px] text-gray-400 text-center">
            Held invoices are saved locally and survive page refreshes
          </p>
        </div>
      </div>

      <style>{`
        @keyframes heldPanelIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>,
    document.body
  );
}
