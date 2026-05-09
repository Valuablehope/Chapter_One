import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArchiveBoxIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Squares2X2Icon,
  CheckBadgeIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';
import { openingStockService, OpeningStockSession } from '../services/openingStockService';
import { productService, Product } from '../services/productService';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import PageBanner from '../components/ui/PageBanner';

// ─── constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

// ─── sub-components ──────────────────────────────────────────────────────────

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
  const [stockFilter, setStockFilter] = useState<'all' | 'filled' | 'empty'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [fetchingProducts, setFetchingProducts] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [showCommitModal, setShowCommitModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const abortRef = useRef<AbortController | null>(null);

  const qtyMapRef = useRef(qtyMap);
  useEffect(() => { qtyMapRef.current = qtyMap; }, [qtyMap]);

  // ── fetch products ────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async (searchTerm = '', pageNum = 1, append = false) => {
    if (pageNum === 1 && !append) {
      if (!isInitialLoadDone) setLoading(true);
      else setFetchingProducts(true);
    } else {
      setFetchingProducts(true);
    }
    setError('');

    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const BATCH_SIZE = 2000;
      const response = await productService.getProducts(
        { track_inventory: true, limit: BATCH_SIZE, page: pageNum, search: searchTerm },
        abortRef.current.signal
      );

      const newProds = response.data;
      setHasMore(newProds.length === BATCH_SIZE);

      setProducts(prev => {
        const currentQtyMap = qtyMapRef.current;
        
        // If appending, keep everything we have. 
        // If NOT appending (new search or initial load), only keep 'filled' products
        const baseList = append ? [...prev] : prev.filter(p => {
          const val = currentQtyMap[p.product_id];
          return val !== undefined && val !== '' && Number(val) > 0;
        });

        const merged = [...baseList];
        newProds.forEach(np => {
          if (!merged.find(p => p.product_id === np.product_id)) {
            merged.push(np);
          }
        });
        return merged;
      });
    } catch (err: any) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        setError('Failed to fetch products. Please try again.');
        console.error('Fetch error:', err);
      }
    } finally {
      setLoading(false);
      setFetchingProducts(false);
    }
  }, [isInitialLoadDone]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProducts(search, nextPage, true);
  };

  // ── load initial session ──────────────────────────────────────────────────
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const sessionData = await openingStockService.getSession();
      setSession(sessionData);

      if (sessionData?.items?.length) {
        const map: Record<string, string> = {};
        const draftProds: Product[] = [];

        for (const item of sessionData.items) {
          map[item.product_id] = String(item.qty);
          draftProds.push({
            product_id: item.product_id,
            name: item.product_name || 'Unknown Product',
            sku: item.sku,
            barcode: item.barcode,
            track_inventory: true,
            unit_of_measure: 'unit',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        setQtyMap(map);
        setProducts(draftProds);
      }
      if (sessionData?.notes) setNotes(sessionData.notes);

      await fetchProducts('', 1, false);
      setIsInitialLoadDone(true);
    } catch (err: any) {
      setError('Failed to load opening stock session.');
    } finally {
      setLoading(false);
    }
  }, [fetchProducts]);

  useEffect(() => {
    loadInitialData();
    return () => abortRef.current?.abort();
  }, [loadInitialData]);

  // Debounced search fetch
  useEffect(() => {
    if (!isInitialLoadDone) return; // Skip if initial load is still in progress

    const timer = setTimeout(() => {
      setPage(1);
      fetchProducts(search, 1, false);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, fetchProducts, isInitialLoadDone]);

  // Reset to page 1 when search or filter changes
  useEffect(() => { setCurrentPage(1); }, [search, stockFilter]);

  // ── derived state ──────────────────────────────────────────────────────────
  const searchFiltered = products.filter(p => {
    // If we have a search term, the 'products' array already contains server-filtered results
    // plus any local 'filled' products. We still apply local filtering to keep it consistent.
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q) ||
      (p.barcode ?? '').toLowerCase().includes(q)
    );
  });

  const filledCount = searchFiltered.filter(p => {
    const v = qtyMap[p.product_id];
    return v !== undefined && v !== '' && Number(v) > 0;
  }).length;
  const emptyCount = searchFiltered.length - filledCount;

  const filteredProducts = searchFiltered.filter(p => {
    if (stockFilter === 'all') return true;
    const v = qtyMap[p.product_id];
    const hasFilled = v !== undefined && v !== '' && Number(v) > 0;
    return stockFilter === 'filled' ? hasFilled : !hasFilled;
  });

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const itemsToSave = Object.entries(qtyMap)
    .filter(([, v]) => v !== '' && Number(v) > 0)
    .map(([product_id, v]) => ({ product_id, qty: Number(v) }));

  const isCommitted = session?.status === 'committed';

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

  // ── render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-secondary-200 border-t-secondary-600" />
      </div>
    );
  }

  const bannerAction = isCommitted ? (
    isAdmin ? (
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowPathIcon className="w-4 h-4" />}
        onClick={() => setShowResetModal(true)}
        className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold backdrop-blur-sm transition-all"
      >
        Reset
      </Button>
    ) : undefined
  ) : (
    <div className="flex gap-2 flex-wrap">
      <Button
        size="sm"
        onClick={handleSaveDraft}
        disabled={saving || committing || itemsToSave.length === 0}
        isLoading={saving}
        className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold backdrop-blur-sm transition-all disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Draft'}
      </Button>
      <Button
        size="sm"
        onClick={() => {
          if (itemsToSave.length === 0 && !session?.items.length) {
            setError('Enter a quantity for at least one product before committing.');
            return;
          }
          setShowCommitModal(true);
        }}
        disabled={saving || committing}
        isLoading={committing}
        className="bg-white/15 hover:bg-white/25 text-white border border-white/20 font-semibold backdrop-blur-sm transition-all disabled:opacity-50"
      >
        {committing ? 'Committing…' : 'Commit Opening Stock'}
      </Button>
    </div>
  );

  return (
    <>
      {/* ── Page banner ── */}
      <PageBanner
        title="Opening Stock"
        subtitle="Set initial on-hand quantities for products before going live"
        icon={<ArchiveBoxIcon className="w-5 h-5 text-white" />}
        action={bannerAction}
      />

      {/* ── Alerts ── */}
      {error && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* ── Session meta (committed state) ── */}
      {isCommitted && session && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Initial stock count as of store opening date"
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 resize-none"
          />
        </div>
      )}

      {/* ── Toolbar: search + counts ── */}
      <Card className="mb-3 border-2 border-gray-100 shadow-md">
        <div className="p-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <MagnifyingGlassIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search by name, SKU, or barcode…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
              />
            </div>
            <button
              onClick={() => fetchProducts(search)}
              disabled={fetchingProducts}
              className="flex items-center space-x-1.5 text-xs font-medium text-gray-600 hover:text-secondary-500 transition-colors px-3 py-2 border-2 border-gray-200 rounded-lg hover:border-secondary-300 disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${fetchingProducts ? 'animate-spin' : ''}`} />
              <span>{fetchingProducts ? 'Searching…' : 'Refresh'}</span>
            </button>
          </div>

          {/* Quick filter badges */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {(
              [
                { 
                  key: 'all',    
                  label: 'All Products',     
                  count: searchFiltered.length,
                  icon: Squares2X2Icon,
                  active: 'bg-indigo-50 text-indigo-700 shadow-sm border-indigo-200',
                  inactive: 'bg-transparent text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50' 
                },
                { 
                  key: 'filled', 
                  label: 'Filled',  
                  count: filledCount,
                  icon: CheckBadgeIcon,
                  active: 'bg-emerald-50 text-emerald-700 shadow-sm border-emerald-200',
                  inactive: 'bg-transparent text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50' 
                },
                { 
                  key: 'empty',  
                  label: 'Empty',   
                  count: emptyCount,
                  icon: InboxIcon,
                  active: 'bg-amber-50 text-amber-700 shadow-sm border-amber-200',
                  inactive: 'bg-transparent text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50' 
                },
              ] as const
            ).map(({ key, label, count, icon: Icon, active, inactive }) => (
              <button
                key={key}
                onClick={() => setStockFilter(key)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border transition-all duration-200 select-none
                  ${stockFilter === key ? active : inactive}`}
              >
                <Icon className={`w-3 h-3 ${stockFilter === key ? 'text-current' : 'text-gray-400'}`} />
                <span>{label}</span>
                <span className={`ml-0.5 px-1 rounded-full text-[8px] tabular-nums transition-colors
                  ${stockFilter === key ? 'bg-current/10 text-current' : 'bg-gray-100 text-gray-400'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <Badge variant="primary" size="sm">{products.length} total</Badge>
            {search && (
              <Badge variant="info" size="sm">{searchFiltered.length} matched</Badge>
            )}
            {!isCommitted && itemsToSave.length > 0 && (
              <Badge variant="success" size="sm">
                {itemsToSave.length} {itemsToSave.length !== 1 ? 'products' : 'product'} with qty entered
              </Badge>
            )}
            {session && <StatusBadge status={session.status} />}
          </div>
        </div>
      </Card>

      {/* ── Product table ── */}
      <Card padding="none" className="overflow-hidden border-2 border-gray-100 shadow-md mb-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Product</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">SKU</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Barcode</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">Balance</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                  {isCommitted ? 'Opening Qty' : 'Opening Qty *'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                    {products.length === 0
                      ? 'No inventory-tracked products found.'
                      : 'No products match your search.'}
                  </td>
                </tr>
              ) : (
                paginatedProducts.map(product => {
                  const committedItem = isCommitted
                    ? session?.items.find(i => i.product_id === product.product_id)
                    : null;

                  const currentBalance = product.balance ?? 0;
                  const hasQty = !!qtyMap[product.product_id] && Number(qtyMap[product.product_id]) > 0;

                  return (
                    <tr
                      key={product.product_id}
                      className={`hover:bg-gray-50 transition-colors ${hasQty && !isCommitted ? 'bg-secondary-50/40' : ''}`}
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
                          <span className={`font-semibold ${committedItem ? 'text-secondary-600' : 'text-gray-300'}`}>
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
                                       focus:outline-none focus:ring-2 focus:ring-secondary-500
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
        {hasMore && (
          <div className="p-4 flex justify-center border-t border-gray-100 bg-gray-50/30">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadMore}
              disabled={fetchingProducts}
              isLoading={fetchingProducts}
              className="min-w-[200px] shadow-sm font-semibold"
            >
              {fetchingProducts ? 'Loading batch…' : 'Load More Products'}
            </Button>
          </div>
        )}
      </Card>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <Card className="mb-4 border-2 border-gray-100">
          <div className="px-3 py-2 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="text-xs text-gray-600 font-medium">
              Showing{' '}
              <span className="font-bold text-gray-900">{((currentPage - 1) * PAGE_SIZE) + 1}</span>
              {' '}to{' '}
              <span className="font-bold text-gray-900">{Math.min(currentPage * PAGE_SIZE, filteredProducts.length)}</span>
              {' '}of{' '}
              <span className="font-bold text-gray-900">{filteredProducts.length}</span>
              {' '}products
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
                className="px-2"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </Button>
              <span className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
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

      {/* ── Footnote (draft only) ── */}
      {!isCommitted && (
        <p className="text-xs text-gray-400 mb-4">
          * Only products with a qty &gt; 0 will be saved.
        </p>
      )}

      {/* ── Commit confirmation modal ── */}
      {showCommitModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0">
                <ArchiveBoxIcon className="w-5 h-5 text-secondary-600" />
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
              <Button variant="secondary" size="sm" onClick={() => setShowCommitModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCommit}
                disabled={committing}
                isLoading={committing}
              >
                {committing ? 'Committing…' : 'Confirm Commit'}
              </Button>
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
              <Button variant="secondary" size="sm" onClick={() => setShowResetModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleReset}
                disabled={resetting}
                isLoading={resetting}
              >
                {resetting ? 'Resetting…' : 'Reset Opening Stock'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
