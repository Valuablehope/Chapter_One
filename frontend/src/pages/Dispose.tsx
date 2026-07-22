import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  ArchiveBoxXMarkIcon,
  PlusIcon,
  TrashIcon,
  Cog6ToothIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { disposeService, Disposal, DisposeReason } from '../services/disposeService';
import { productService, Product } from '../services/productService';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import PageBanner from '../components/ui/PageBanner';

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtQty(n: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(n);
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface CartLine {
  product_id: string;
  product_name: string;
  sku?: string;
  balance: number;
  qty: string;
  reason_id: number | '';
  note: string;
}

type Tab = 'dispose' | 'history' | 'reasons';

export default function Dispose() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [tab, setTab] = useState<Tab>('dispose');
  const [reasons, setReasons] = useState<DisposeReason[]>([]);

  // ── dispose tab ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [overallNotes, setOverallNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState('');
  const [successBanner, setSuccessBanner] = useState<Disposal | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // ── history tab ────────────────────────────────────────────────────────────
  const [date, setDate] = useState(todayISO());
  const [showAllDates, setShowAllDates] = useState(false);
  const [disposals, setDisposals] = useState<Disposal[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDisposal, setExpandedDisposal] = useState<Disposal | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── reasons tab ────────────────────────────────────────────────────────────
  const [newReasonName, setNewReasonName] = useState('');
  const [reasonSaving, setReasonSaving] = useState(false);
  const [reasonError, setReasonError] = useState('');

  // ── load reasons ───────────────────────────────────────────────────────────
  const loadReasons = useCallback(async () => {
    try {
      const r = await disposeService.getReasons();
      setReasons(r);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadReasons();
  }, [loadReasons]);

  // ── product search ─────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    if (!q.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    abortRef.current = new AbortController();
    setSearching(true);
    try {
      const res = await productService.getProducts(
        { track_inventory: true, search: q, page: 1, limit: 8 },
        abortRef.current.signal
      );
      setSearchResults(res.data);
      setShowResults(true);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
    } finally {
      setSearching(false);
    }
  }, []);

  const debouncedSearch = useDebouncedCallback((q: string) => runSearch(q), 300);

  const handleSearchChange = (v: string) => {
    setSearchQuery(v);
    debouncedSearch(v);
  };

  const defaultReasonId = reasons.length > 0 ? reasons[0].reason_id : '';

  const addToCart = (p: Product) => {
    if (cart.some((c) => c.product_id === p.product_id)) {
      setSearchQuery('');
      setShowResults(false);
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        product_id: p.product_id,
        product_name: p.name,
        sku: p.sku,
        balance: p.balance ?? 0,
        qty: '1',
        reason_id: defaultReasonId,
        note: '',
      },
    ]);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  };

  const updateCartLine = (productId: string, patch: Partial<CartLine>) => {
    setCart((prev) => prev.map((c) => (c.product_id === productId ? { ...c, ...patch } : c)));
  };

  const totalQty = cart.reduce((s, c) => s + (parseFloat(c.qty) || 0), 0);

  const cartHasErrors = cart.some((c) => {
    const q = parseFloat(c.qty);
    return !q || q <= 0 || q > c.balance || !c.reason_id;
  });

  const canSubmit = cart.length > 0 && !cartHasErrors && !submitting;

  const handleSubmit = async () => {
    setFormError('');
    if (cart.length === 0) {
      setFormError('Add at least one product to dispose.');
      return;
    }
    if (cartHasErrors) {
      setFormError('Fix the highlighted rows before submitting (quantity and reason are required).');
      return;
    }
    setSubmitting(true);
    try {
      const disposal = await disposeService.createDisposal({
        items: cart.map((c) => ({
          product_id: c.product_id,
          qty: parseFloat(c.qty),
          reason_id: Number(c.reason_id),
          note: c.note.trim() || undefined,
        })),
        notes: overallNotes.trim() || undefined,
      });
      setSuccessBanner(disposal);
      setCart([]);
      setOverallNotes('');
      setShowConfirm(false);
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message ?? err?.response?.data?.message ?? 'Failed to record disposal.');
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ── history ────────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError('');
    try {
      const result = await disposeService.getDisposals(showAllDates ? undefined : date, historyPage, 20);
      setDisposals(result.data);
      setHistoryPagination(result.pagination);
    } catch {
      setHistoryError('Failed to load disposal history.');
    } finally {
      setLoadingHistory(false);
    }
  }, [date, showAllDates, historyPage]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, loadHistory]);

  const toggleExpand = async (disposalId: string) => {
    if (expandedId === disposalId) {
      setExpandedId(null);
      setExpandedDisposal(null);
      return;
    }
    setExpandedId(disposalId);
    setExpandedDisposal(null);
    try {
      const full = await disposeService.getDisposalById(disposalId);
      setExpandedDisposal(full);
    } catch {
      setHistoryError('Failed to load disposal details.');
    }
  };

  const handleDeleteDisposal = async (disposalId: string) => {
    setDeletingId(disposalId);
    try {
      await disposeService.deleteDisposal(disposalId);
      setDisposals((prev) => prev.filter((d) => d.disposal_id !== disposalId));
      if (expandedId === disposalId) {
        setExpandedId(null);
        setExpandedDisposal(null);
      }
    } catch (err: any) {
      setHistoryError(err?.response?.data?.error?.message ?? 'Failed to reverse disposal.');
    } finally {
      setDeletingId(null);
    }
  };

  const historyTotalQty = disposals.reduce((s, d) => s + Number(d.total_qty), 0);
  const historyTotalValue = disposals.reduce((s, d) => s + Number(d.total_value_lost), 0);

  // ── reasons ────────────────────────────────────────────────────────────────
  const handleAddReason = async () => {
    if (!newReasonName.trim()) {
      setReasonError('Enter a reason name.');
      return;
    }
    setReasonSaving(true);
    setReasonError('');
    try {
      const reason = await disposeService.createReason(newReasonName.trim());
      setReasons((prev) => [...prev, reason]);
      setNewReasonName('');
    } catch (err: any) {
      setReasonError(err?.response?.data?.error?.message ?? 'Failed to add reason.');
    } finally {
      setReasonSaving(false);
    }
  };

  const handleDeleteReason = async (reasonId: number) => {
    try {
      await disposeService.deleteReason(reasonId);
      setReasons((prev) => prev.filter((r) => r.reason_id !== reasonId));
    } catch (err: any) {
      setReasonError(err?.response?.data?.error?.message ?? 'Cannot delete reason (may be used by a disposal).');
    }
  };

  return (
    <>
      {/* ── Page banner ── */}
      <PageBanner
        title="Dispose Items"
        subtitle="Write off expired, damaged, or lost stock and keep a record of why"
        icon={<ArchiveBoxXMarkIcon className="w-5 h-5 text-white" />}
      />

      {/* ── Tabs ── */}
      <div className="flex border-b border-gray-200 mb-5">
        {(['dispose', 'history', 'reasons'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? 'border-secondary-500 text-secondary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t === 'dispose' ? 'Dispose Items' : t === 'history' ? 'History' : 'Reasons'}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: DISPOSE
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'dispose' && (
        <div className="space-y-4">
          {successBanner && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">
                  Disposed {fmtQty(Number(successBanner.total_qty))} unit(s) across{' '}
                  {successBanner.items?.length ?? ''} product(s).
                </p>
                {Number(successBanner.total_value_lost) > 0 && (
                  <p className="text-xs text-green-600 mt-0.5">
                    Estimated value lost: ${fmtMoney(Number(successBanner.total_value_lost))}
                  </p>
                )}
              </div>
            </div>
          )}

          {formError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {formError}
            </div>
          )}

          {/* Product search */}
          <Card className="border-2 border-gray-100 shadow-md">
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MagnifyingGlassIcon className="w-4 h-4 text-secondary-500" />
                <h2 className="text-sm font-semibold text-gray-700">Add a product to dispose</h2>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  placeholder="Search by name, SKU, or barcode…"
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white"
                />
                {showResults && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                    {searching ? (
                      <div className="p-3 text-center text-sm text-gray-400">Searching…</div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-3 text-center text-sm text-gray-400">No inventory-tracked products found.</div>
                    ) : (
                      searchResults.map((p) => {
                        const inCart = cart.some((c) => c.product_id === p.product_id);
                        return (
                          <button
                            key={p.product_id}
                            onClick={() => addToCart(p)}
                            disabled={inCart}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span>
                              <span className="font-medium text-gray-800">{p.name}</span>
                              <span className="text-gray-400 ml-2 text-xs">{p.sku ?? '—'}</span>
                            </span>
                            <span className="text-xs text-gray-500">
                              {inCart ? 'Added' : `Balance: ${fmtQty(p.balance ?? 0)}`}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Cart */}
          <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-md">
            {cart.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                No products added yet. Search above to start a disposal.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Product</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Balance</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Qty *</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Reason *</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Note</th>
                      <th className="px-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {cart.map((line) => {
                      const q = parseFloat(line.qty);
                      const qtyInvalid = !q || q <= 0 || q > line.balance;
                      return (
                        <tr key={line.product_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-gray-800">{line.product_name}</span>
                            {line.sku && <span className="text-gray-400 ml-2 text-xs">{line.sku}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600">{fmtQty(line.balance)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={line.qty}
                              onChange={(e) => updateCartLine(line.product_id, { qty: e.target.value })}
                              className={`w-20 text-right border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 ${
                                qtyInvalid ? 'border-red-300 focus:ring-red-400' : 'border-gray-200 focus:ring-secondary-500'
                              } [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <select
                              value={line.reason_id}
                              onChange={(e) => updateCartLine(line.product_id, { reason_id: Number(e.target.value) })}
                              className="border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 bg-white"
                            >
                              <option value="">Select…</option>
                              {reasons.map((r) => (
                                <option key={r.reason_id} value={r.reason_id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2.5 hidden md:table-cell">
                            <input
                              type="text"
                              value={line.note}
                              onChange={(e) => updateCartLine(line.product_id, { note: e.target.value })}
                              placeholder="Optional note…"
                              maxLength={500}
                              className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => removeFromCart(line.product_id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {cart.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-secondary-50">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {cart.length} product{cart.length !== 1 ? 's' : ''}
                  </span>
                  <Badge variant="primary" size="sm">{fmtQty(totalQty)} total units</Badge>
                </div>
              </div>
            )}
          </Card>

          {cart.length > 0 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
                <textarea
                  value={overallNotes}
                  onChange={(e) => setOverallNotes(e.target.value)}
                  placeholder="e.g. Freezer failure overnight, batch #123"
                  rows={2}
                  maxLength={2000}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 resize-none"
                />
              </div>

              <Button
                variant="primary"
                disabled={!canSubmit}
                onClick={() => setShowConfirm(true)}
                leftIcon={<ArchiveBoxXMarkIcon className="w-4 h-4" />}
              >
                Dispose {cart.length} Product{cart.length !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: HISTORY
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'history' && (
        <div className="space-y-4">
          <Card className="border-2 border-gray-100 shadow-md">
            <div className="p-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  disabled={showAllDates}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white disabled:opacity-50"
                />
              </div>
              <label className="flex items-center gap-1.5 text-sm text-gray-600 pb-1.5">
                <input
                  type="checkbox"
                  checked={showAllDates}
                  onChange={(e) => {
                    setShowAllDates(e.target.checked);
                    setHistoryPage(1);
                  }}
                />
                All dates
              </label>
            </div>
          </Card>

          {historyError && (
            <div className="flex items-center gap-1.5 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
              {historyError}
            </div>
          )}

          <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-md">
            {loadingHistory ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-4 border-secondary-200 border-t-secondary-600" />
              </div>
            ) : disposals.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No disposals recorded.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                        <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Date</th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">Disposed By</th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Items</th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Qty</th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Value Lost</th>
                        <th className="px-4 py-2.5 w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {disposals.map((d) => (
                        <Fragment key={d.disposal_id}>
                          <tr
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => toggleExpand(d.disposal_id)}
                          >
                            <td className="px-4 py-2.5 font-medium text-gray-800">{fmtDate(d.disposed_at)}</td>
                            <td className="px-3 py-2.5 text-gray-500 hidden sm:table-cell">{d.disposed_by_name ?? '—'}</td>
                            <td className="px-3 py-2.5 text-right text-gray-600">{d.item_count ?? 0}</td>
                            <td className="px-3 py-2.5 text-right text-gray-600">{fmtQty(Number(d.total_qty))}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-gray-800">
                              ${fmtMoney(Number(d.total_value_lost))}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {expandedId === d.disposal_id ? (
                                <ChevronUpIcon className="w-4 h-4 text-gray-400 mx-auto" />
                              ) : (
                                <ChevronDownIcon className="w-4 h-4 text-gray-400 mx-auto" />
                              )}
                            </td>
                          </tr>
                          {expandedId === d.disposal_id && (
                            <tr>
                              <td colSpan={6} className="bg-gray-50 px-4 py-3">
                                {!expandedDisposal ? (
                                  <div className="text-xs text-gray-400 py-2">Loading…</div>
                                ) : (
                                  <div className="space-y-2">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-gray-500">
                                          <th className="text-left py-1 font-semibold">Product</th>
                                          <th className="text-left py-1 font-semibold">Reason</th>
                                          <th className="text-right py-1 font-semibold">Qty</th>
                                          <th className="text-right py-1 font-semibold">Unit Cost</th>
                                          <th className="text-right py-1 font-semibold">Value Lost</th>
                                          <th className="text-left py-1 font-semibold">Note</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {expandedDisposal.items?.map((it) => (
                                          <tr key={it.disposal_item_id}>
                                            <td className="py-1.5 font-medium text-gray-700">{it.product_name}</td>
                                            <td className="py-1.5 text-gray-600">{it.reason_name}</td>
                                            <td className="py-1.5 text-right text-gray-600">{fmtQty(Number(it.qty))}</td>
                                            <td className="py-1.5 text-right text-gray-600">${fmtMoney(Number(it.unit_cost))}</td>
                                            <td className="py-1.5 text-right text-gray-600">${fmtMoney(Number(it.value_lost))}</td>
                                            <td className="py-1.5 text-gray-500">{it.note ?? '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    {expandedDisposal.notes && (
                                      <p className="text-xs text-gray-500 italic">Note: {expandedDisposal.notes}</p>
                                    )}
                                    {isAdmin && (
                                      <div className="pt-1">
                                        <Button
                                          variant="danger"
                                          size="sm"
                                          onClick={() => handleDeleteDisposal(d.disposal_id)}
                                          disabled={deletingId === d.disposal_id}
                                          isLoading={deletingId === d.disposal_id}
                                          leftIcon={<TrashIcon className="w-3.5 h-3.5" />}
                                        >
                                          Reverse &amp; Delete
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-secondary-50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {showAllDates ? 'Total (all dates shown)' : `Total for ${date}`}
                    </span>
                    <Badge variant="primary" size="sm">{fmtQty(historyTotalQty)} units</Badge>
                  </div>
                  <span className="text-base font-bold text-secondary-700">${fmtMoney(historyTotalValue)}</span>
                </div>
              </>
            )}
          </Card>

          {historyPagination.totalPages > 1 && (
            <Card className="border-2 border-gray-100">
              <div className="px-3 py-2 flex justify-between items-center gap-2">
                <span className="text-xs text-gray-600 font-medium">
                  Page {historyPagination.page} of {historyPagination.totalPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPagination.page === 1}
                    variant="outline"
                    size="sm"
                    className="px-2"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => setHistoryPage((p) => Math.min(historyPagination.totalPages, p + 1))}
                    disabled={historyPagination.page === historyPagination.totalPages}
                    variant="outline"
                    size="sm"
                    className="px-2"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: REASONS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'reasons' && (
        <div className="space-y-4">
          {isManager && (
            <Card className="border-2 border-gray-100 shadow-md">
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Cog6ToothIcon className="w-4 h-4 text-secondary-500" />
                  <h2 className="text-sm font-semibold text-gray-700">Add Custom Reason</h2>
                </div>
                {reasonError && (
                  <div className="flex items-center gap-1.5 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    {reasonError}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newReasonName}
                    onChange={(e) => setNewReasonName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddReason()}
                    placeholder="Reason name…"
                    maxLength={100}
                    className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAddReason}
                    disabled={reasonSaving}
                    isLoading={reasonSaving}
                    leftIcon={<PlusIcon className="w-4 h-4" />}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Type</th>
                  {isAdmin && <th className="px-4 py-2.5 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reasons.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 3 : 2} className="text-center py-10 text-gray-400 text-sm">
                      No reasons yet.
                    </td>
                  </tr>
                ) : (
                  reasons.map((reason) => (
                    <tr key={reason.reason_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{reason.name}</td>
                      <td className="px-3 py-2.5 text-center">
                        {reason.is_system ? (
                          <span className="text-xs text-secondary-600 bg-secondary-50 border border-secondary-200 rounded-full px-2 py-0.5">System</span>
                        ) : (
                          <span className="text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">Custom</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-2.5 text-center">
                          {!reason.is_system ? (
                            <button
                              onClick={() => handleDeleteReason(reason.reason_id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <LockClosedIcon className="w-4 h-4 text-gray-300 mx-auto" />
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── Confirm disposal modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <ArchiveBoxXMarkIcon className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Confirm Disposal?</h2>
                <p className="text-sm text-gray-500">Stock will be removed immediately.</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>{cart.length}</strong> product{cart.length !== 1 ? 's' : ''} totalling{' '}
              <strong>{fmtQty(totalQty)}</strong> unit(s) will be subtracted from stock. This can only be reversed by an admin.
            </div>
            <ul className="text-sm text-gray-600 space-y-1 max-h-40 overflow-y-auto">
              {cart.map((c) => (
                <li key={c.product_id} className="flex justify-between gap-2">
                  <span>{c.product_name}</span>
                  <span className="text-gray-900 font-medium">{fmtQty(parseFloat(c.qty) || 0)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => setShowConfirm(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSubmit} disabled={submitting} isLoading={submitting}>
                {submitting ? 'Disposing…' : 'Confirm Disposal'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
