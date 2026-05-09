import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArchiveBoxIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { openingStockService, OpeningStockSession } from '../services/openingStockService';
import { productService, Product } from '../services/productService';
import { useAuthStore } from '../store/authStore';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

// ─── sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'draft' | 'committed' }) {
  if (status === 'committed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
        <CheckCircleIcon className="w-3.5 h-3.5" />
        Committed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
      <ArrowPathIcon className="w-3.5 h-3.5" />
      Draft
    </span>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function OpeningStock() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [session, setSession] = useState<OpeningStockSession | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [qtyMap, setQtyMap] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [showCommitModal, setShowCommitModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const abortRef = useRef<AbortController | null>(null);

  // ── load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      abortRef.current = new AbortController();
      const [sessionData, productsData] = await Promise.all([
        openingStockService.getSession(),
        productService.getProducts(
          { track_inventory: true, limit: 1000 },
          abortRef.current.signal
        ),
      ]);

      setSession(sessionData);
      setProducts(productsData.data);

      // Pre-populate qty inputs from existing session items
      if (sessionData?.items?.length) {
        const map: Record<string, string> = {};
        for (const item of sessionData.items) {
          map[item.product_id] = String(item.qty);
        }
        setQtyMap(map);
      }
      if (sessionData?.notes) setNotes(sessionData.notes);
    } catch (err: any) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        setError('Failed to load data. Please refresh.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    return () => abortRef.current?.abort();
  }, [loadData]);

  // ── filtered product list ──────────────────────────────────────────────────
  const filteredProducts = products.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q) ||
      (p.barcode ?? '').toLowerCase().includes(q)
    );
  });

  const itemsToSave = Object.entries(qtyMap)
    .filter(([, v]) => v !== '' && Number(v) > 0)
    .map(([product_id, v]) => ({ product_id, qty: Number(v) }));

  // ── actions ────────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (itemsToSave.length === 0) {
      setError('Enter a quantity for at least one product before saving.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const updated = await openingStockService.saveDraft({ notes, items: itemsToSave });
      setSession(updated);
      setSuccessMsg('Draft saved successfully.');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleCommit = async () => {
    setCommitting(true);
    setError('');
    setSuccessMsg('');
    try {
      let currentSession = session;

      // If no session yet, or draft with pending qty changes — persist first
      if (!currentSession || (currentSession.status === 'draft' && itemsToSave.length > 0)) {
        if (itemsToSave.length === 0) {
          throw new Error('Enter a quantity for at least one product before committing.');
        }
        const draft = await openingStockService.saveDraft({ notes, items: itemsToSave });
        setSession(draft);
        currentSession = draft;
      }

      const committed = await openingStockService.commit(currentSession!.session_id);
      setSession(committed);
      setSuccessMsg(`Opening stock committed! Reference: ${committed.reference}`);
      setShowCommitModal(false);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Failed to commit.');
      setShowCommitModal(false);
    } finally {
      setCommitting(false);
    }
  };

  const handleReset = async () => {
    if (!session) return;
    setResetting(true);
    setError('');
    setSuccessMsg('');
    try {
      await openingStockService.reset(session.session_id);
      setSession(null);
      setQtyMap({});
      setNotes('');
      setSuccessMsg('Opening stock reset. You can start a new session.');
      setShowResetModal(false);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Failed to reset.');
      setShowResetModal(false);
    } finally {
      setResetting(false);
    }
  };

  const isCommitted = session?.status === 'committed';

  // ── render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <ArchiveBoxIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Opening Stock</h1>
            <p className="text-sm text-gray-500">Set initial on-hand quantities for products before going live</p>
          </div>
        </div>
        {session && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <StatusBadge status={session.status} />
            {isCommitted && isAdmin && (
              <button
                onClick={() => setShowResetModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
              >
                <ArrowPathIcon className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* ── Session meta (read-only if committed) ── */}
      {isCommitted && session && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Reference</p>
            <p className="font-semibold text-gray-800">{session.reference}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Committed</p>
            <p className="font-semibold text-gray-800">{fmtDate(session.committed_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Products</p>
            <p className="font-semibold text-gray-800">{session.items.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Total Units</p>
            <p className="font-semibold text-gray-800">
              {session.items.reduce((s, i) => s + i.qty, 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* ── Notes (draft only) ── */}
      {!isCommitted && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Initial stock count as of store opening date"
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </div>
      )}

      {/* ── Product table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Search bar */}
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by name, SKU, or barcode…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400"
          />
          <span className="text-xs text-gray-400 flex-shrink-0">
            {filteredProducts.length} / {products.length} products
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Product</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-600 hidden sm:table-cell">SKU</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-600 hidden md:table-cell">Barcode</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600">Current Balance</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">
                  {isCommitted ? 'Opening Qty' : 'Opening Qty *'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                    {products.length === 0
                      ? 'No inventory-tracked products found.'
                      : 'No products match your search.'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  const committedItem = isCommitted
                    ? session?.items.find(i => i.product_id === product.product_id)
                    : null;

                  const currentBalance = product.balance ?? 0;
                  const hasQty = !!qtyMap[product.product_id] && Number(qtyMap[product.product_id]) > 0;

                  return (
                    <tr
                      key={product.product_id}
                      className={`hover:bg-gray-50 transition-colors ${hasQty && !isCommitted ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-gray-800">{product.name}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 hidden sm:table-cell">
                        {product.sku ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 hidden md:table-cell">
                        {product.barcode ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`font-medium ${currentBalance < 0 ? 'text-red-500' : 'text-gray-700'}`}>
                          {currentBalance.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isCommitted ? (
                          <span className={`font-semibold ${committedItem ? 'text-blue-700' : 'text-gray-300'}`}>
                            {committedItem ? committedItem.qty.toLocaleString() : '—'}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={qtyMap[product.product_id] ?? ''}
                            onChange={e => {
                              const val = e.target.value;
                              setQtyMap(prev => ({ ...prev, [product.product_id]: val }));
                            }}
                            placeholder="0"
                            className="w-24 text-right border border-gray-200 rounded-md px-2 py-1 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400
                                       [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Action buttons ── */}
      {!isCommitted && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            * Only products with a qty &gt; 0 will be saved.
            {itemsToSave.length > 0 && (
              <span className="ml-2 font-medium text-blue-600">
                {itemsToSave.length} product{itemsToSave.length !== 1 ? 's' : ''} entered.
              </span>
            )}
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleSaveDraft}
              disabled={saving || committing || itemsToSave.length === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                         rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={() => {
                if (itemsToSave.length === 0 && !session?.items.length) {
                  setError('Enter a quantity for at least one product before committing.');
                  return;
                }
                setShowCommitModal(true);
              }}
              disabled={saving || committing}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600
                         rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {committing ? 'Committing…' : 'Commit Opening Stock'}
            </button>
          </div>
        </div>
      )}

      {/* ── Commit confirmation modal ── */}
      {showCommitModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <ArchiveBoxIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Commit Opening Stock?</h2>
                <p className="text-sm text-gray-500">This will create stock movement records for all entered quantities.</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Once committed, stock movements cannot be undone</strong> without an admin reset.
              Make sure all quantities are correct before proceeding.
            </div>
            <p className="text-sm text-gray-600">
              <span className="font-medium">{itemsToSave.length || session?.items.length}</span> products will be processed.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowCommitModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                disabled={committing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {committing ? 'Committing…' : 'Confirm Commit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset confirmation modal (admin only) ── */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Reset Opening Stock?</h2>
                <p className="text-sm text-gray-500">This will reverse all stock movements created by the opening stock commit.</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              <strong>This is destructive.</strong> All opening stock movements will be deleted and product
              balances will be reduced accordingly. This cannot be undone.
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {resetting ? 'Resetting…' : 'Reset Opening Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
