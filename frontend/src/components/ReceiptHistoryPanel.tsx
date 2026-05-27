import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowPathIcon,
  PrinterIcon,
  ReceiptPercentIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { saleService, Sale } from '../services/saleService';
import { StoreSettings } from '../services/storeService';
import Receipt from './Receipt';
import { useTranslation } from '../i18n/I18nContext';
import { buildReceiptHtml } from '../utils/buildReceiptHtml';
import Modal from './ui/Modal';
import Button from './ui/Button';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  storeSettings: StoreSettings | null;
  refreshTrigger: string | null;
}

function relativeTime(dateStr: string, timezone?: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: timezone ?? 'UTC',
    }).format(new Date(dateStr));
  } catch {
    return new Date(dateStr).toLocaleDateString();
  }
}

export default function ReceiptHistoryPanel({ isOpen, onClose, storeSettings, refreshTrigger }: Props) {
  const { t } = useTranslation();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [fetchingDetail, setFetchingDetail] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const receiptRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatCurrency = useCallback(
    (n: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: storeSettings?.currency_code ?? 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n),
    [storeSettings?.currency_code],
  );

  const loadSales = useCallback(async (search?: string) => {
    if (!storeSettings?.store_id) return;
    setLoading(true);
    try {
      const { data } = await saleService.getSales({
        store_id: storeSettings.store_id,
        limit: 20,
        page: 1,
        ...(search ? { search } : {}),
      });
      setSales(data);
    } catch {
      // silently skip
    } finally {
      setLoading(false);
    }
  }, [storeSettings?.store_id]);

  // Load on open and whenever a new sale completes
  useEffect(() => {
    if (isOpen) loadSales();
  }, [isOpen, loadSales, refreshTrigger]);

  // Clear selection and search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedSale(null);
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      loadSales(value || undefined);
    }, 400);
  }, [loadSales]);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    loadSales();
  }, [loadSales]);

  const selectSale = async (sale: Sale) => {
    if (fetchingDetail) return;
    setFetchingDetail(true);
    try {
      const full = await saleService.getSaleById(sale.sale_id);
      setSales(prev => prev.map(s => (s.sale_id === full.sale_id ? full : s)));
      setSelectedSale(full);
    } catch {
      toast.error('Failed to load receipt');
    } finally {
      setFetchingDetail(false);
    }
  };

  const handlePrint = () => {
    if (!selectedSale) return;
    const html = buildReceiptHtml({
      sale: selectedSale,
      settings: storeSettings,
      items: selectedSale.items,
      customer: selectedSale.customer as any ?? null,
      t,
    });
    if ((window as any).electronAPI?.printSilent) {
      (window as any).electronAPI
        .printSilent(storeSettings?.receipt_printer ?? undefined, html, storeSettings?.paper_size || '80mm')
        .then((res: { success: boolean; error?: string }) => {
          if (!res.success) toast.error(`Print failed: ${res.error ?? 'Unknown error'}`);
          else toast.success('Receipt sent to printer.');
        });
      onClose();
    } else {
      toast.error('Silent print is not available on this platform.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-secondary-500 rounded-lg flex-shrink-0">
            <ClockIcon className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">Receipt History</span>
          {sales.length > 0 && !loading && (
            <span className="text-xs font-semibold bg-secondary-100 text-secondary-600 px-2 py-0.5 rounded-full">
              {sales.length}
            </span>
          )}
        </div>
      }
      size="lg"
      footer={
        selectedSale ? (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-gray-400">
              Receipt #{selectedSale.receipt_no}
            </span>
            <div className="flex gap-2">
              {(window as any).electronAPI?.printSilent && (
                <Button
                  onClick={handlePrint}
                  className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold shadow-brand"
                  leftIcon={<PrinterIcon className="w-4 h-4" />}
                >
                  Print &amp; Close
                </Button>
              )}
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end w-full">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        )
      }
    >
      <div className="flex h-[500px] -mx-6 -mb-2">

        {/* ── Left panel: sales list ── */}
        <div className="w-56 flex-shrink-0 flex flex-col border-r border-[#e2e8f0]">
          {/* List header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#e2e8f0] bg-[#f8fafc]">
            <span className="text-xs font-semibold text-gray-600">
              {searchTerm ? 'Search results' : 'Last 20 sales'}
            </span>
            <button
              onClick={() => loadSales(searchTerm || undefined)}
              title="Refresh"
              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-secondary-500 transition-colors"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search input */}
          <div className="px-2 py-1.5 border-b border-[#e2e8f0] bg-[#f8fafc]">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search receipt #..."
                className="w-full pl-6 pr-5 py-1 text-[11px] bg-white border border-gray-200 rounded text-gray-700 placeholder-gray-400 focus:outline-none focus:border-secondary-400 focus:ring-1 focus:ring-secondary-200"
              />
              {searchTerm && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* List body */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#f1f5f9]">
            {loading && sales.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-12 text-xs text-gray-400">
                <div className="w-4 h-4 border-2 border-secondary-200 border-t-secondary-500 rounded-full animate-spin" />
                Loading…
              </div>
            ) : sales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <ReceiptPercentIcon className="w-7 h-7 text-gray-200" />
                <p className="text-xs text-gray-400">
                  {searchTerm ? 'No results found' : 'No recent sales'}
                </p>
              </div>
            ) : (
              sales.map(sale => {
                const isSelected = selectedSale?.sale_id === sale.sale_id;
                return (
                  <button
                    key={sale.sale_id}
                    onClick={() => selectSale(sale)}
                    disabled={fetchingDetail}
                    className={`
                      w-full text-left flex flex-col gap-0.5 px-3 py-2.5
                      transition-colors disabled:opacity-50 disabled:cursor-wait
                      ${isSelected
                        ? 'bg-secondary-50 border-l-2 border-l-secondary-500'
                        : 'hover:bg-gray-50 border-l-2 border-l-transparent'}
                    `}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[11px] font-bold leading-none truncate ${isSelected ? 'text-secondary-600' : 'text-gray-700'}`}>
                        {sale.receipt_no}
                      </span>
                      <span className="text-[9px] text-gray-400 flex-shrink-0 leading-none">
                        {relativeTime(sale.created_at, storeSettings?.timezone)}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-gray-800 tabular-nums leading-none">
                      {formatCurrency(Number(sale.grand_total))}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right panel: receipt preview ── */}
        <div className="flex-1 overflow-y-auto bg-[#f8fafc]">
          {fetchingDetail ? (
            <div className="flex items-center justify-center h-full gap-2 text-sm text-gray-400">
              <div className="w-5 h-5 border-2 border-secondary-200 border-t-secondary-500 rounded-full animate-spin" />
              Loading receipt…
            </div>
          ) : selectedSale ? (
            <div className="p-4" ref={receiptRef}>
              <Receipt
                settings={storeSettings}
                sale={selectedSale}
                customer={(selectedSale.customer ?? null) as any}
                items={(selectedSale.items ?? []) as any}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-secondary-50 flex items-center justify-center">
                <ReceiptPercentIcon className="w-7 h-7 text-secondary-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Select a receipt</p>
                <p className="text-xs text-gray-400 mt-0.5">Click any entry on the left to preview it here</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </Modal>
  );
}
