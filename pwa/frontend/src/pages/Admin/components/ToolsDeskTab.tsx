import { useCallback, useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import toast from 'react-hot-toast';
import {
  ArrowUturnLeftIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  WrenchScrewdriverIcon,
  ComputerDesktopIcon,
  KeyIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import EmptyState from '../../../components/ui/EmptyState';
import { productService, Product } from '../../../services/productService';
import { terminalService, SelfTerminal } from '../../../services/terminalService';
import { storeService } from '../../../services/storeService';
import { useLocalPrinterPreference } from '../../../hooks/useLocalPrinterPreference';
import { useTranslation } from '../../../i18n/I18nContext';

type ToolKey = 'reactivate_product' | 'this_terminal';

export default function ToolsDeskTab() {
  const { t } = useTranslation();
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null);

  return (
    <div className="p-3">
      {!activeTool && (
        <>
          <p className="text-xs text-gray-500 mb-3">{t('admin.tools_desk.subtitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => setActiveTool('reactivate_product')}
              className="text-left"
            >
              <Card className="h-full border-2 border-gray-100 hover:border-secondary-300 hover:shadow-md transition-all">
                <div className="p-4 flex items-start gap-3">
                  <div className="p-2 bg-secondary-50 rounded-lg text-secondary-500 flex-shrink-0">
                    <ArrowPathIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{t('admin.tools_desk.tools.reactivate_product.title')}</div>
                    <div className="text-xs text-gray-500 mt-1">{t('admin.tools_desk.tools.reactivate_product.description')}</div>
                  </div>
                </div>
              </Card>
            </button>

            <button
              onClick={() => setActiveTool('this_terminal')}
              className="text-left"
            >
              <Card className="h-full border-2 border-gray-100 hover:border-secondary-300 hover:shadow-md transition-all">
                <div className="p-4 flex items-start gap-3">
                  <div className="p-2 bg-secondary-50 rounded-lg text-secondary-500 flex-shrink-0">
                    <ComputerDesktopIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{t('admin.tools_desk.tools.this_terminal.title')}</div>
                    <div className="text-xs text-gray-500 mt-1">{t('admin.tools_desk.tools.this_terminal.description')}</div>
                  </div>
                </div>
              </Card>
            </button>
          </div>
        </>
      )}

      {activeTool === 'reactivate_product' && (
        <ReactivateProductTool onBack={() => setActiveTool(null)} />
      )}

      {activeTool === 'this_terminal' && (
        <ThisTerminalTool onBack={() => setActiveTool(null)} />
      )}
    </div>
  );
}

function ThisTerminalTool({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [self, setSelf] = useState<SelfTerminal | null>(null);
  const [loadingSelf, setLoadingSelf] = useState(true);
  const [pairingCode, setPairingCode] = useState('');
  const [pairing, setPairing] = useState(false);
  const [printers, setPrinters] = useState<any[]>([]);
  const [legacyPrinter, setLegacyPrinter] = useState<string | null | undefined>(undefined);
  const { printer, setPrinter } = useLocalPrinterPreference(legacyPrinter);

  const loadSelf = useCallback(async () => {
    try {
      const data = await terminalService.getSelf();
      setSelf(data);
    } catch {
      setSelf({ terminal_id: null });
    } finally {
      setLoadingSelf(false);
    }
  }, []);

  useEffect(() => {
    loadSelf();
  }, [loadSelf]);

  useEffect(() => {
    if (window.electronAPI?.getPrinters) {
      window.electronAPI.getPrinters().then(setPrinters).catch(() => setPrinters([]));
    }
    storeService.getDefaultStore()
      .then(s => setLegacyPrinter(s.receipt_printer || null))
      .catch(() => setLegacyPrinter(null));
  }, []);

  const handlePair = async () => {
    if (!pairingCode.trim()) return;
    setPairing(true);
    try {
      const result = await terminalService.pair(pairingCode.trim());
      if (result.success) {
        toast.success(t('admin.tools_desk.this_terminal.pair_success', { name: result.name || '' }));
        setPairingCode('');
        loadSelf();
      } else {
        toast.error(result.error || t('admin.tools_desk.this_terminal.pair_error'));
      }
    } finally {
      setPairing(false);
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-secondary-500 mb-3"
      >
        <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
        {t('admin.tools_desk.back')}
      </button>

      <Card className="border-2 border-gray-100 shadow-md">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ComputerDesktopIcon className="w-4 h-4 text-secondary-500" />
            <h3 className="text-sm font-bold text-gray-900">{t('admin.tools_desk.tools.this_terminal.title')}</h3>
          </div>

          {/* Pairing status */}
          {loadingSelf ? (
            <p className="text-xs text-gray-400">...</p>
          ) : self?.terminal_id ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
              <div>
                <div className="text-xs font-bold text-emerald-700">
                  {t('admin.tools_desk.this_terminal.paired_as')}: {self.name} ({self.code})
                </div>
                {self.last_seen_at && (
                  <div className="text-[11px] text-emerald-600 mt-0.5">
                    {t('admin.tools_desk.this_terminal.last_seen')}: {new Date(self.last_seen_at).toLocaleString()}
                  </div>
                )}
              </div>
              <Badge variant="success" size="sm">{self.is_online ? 'Online' : 'Offline'}</Badge>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
              <div className="text-xs font-bold text-gray-700">{t('admin.tools_desk.this_terminal.not_paired')}</div>
              <p className="text-[11px] text-gray-500">{t('admin.tools_desk.this_terminal.not_paired_hint')}</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyIcon className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                    placeholder={t('admin.tools_desk.this_terminal.pairing_code_placeholder')}
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono uppercase border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 bg-white"
                  />
                </div>
                <Button size="sm" onClick={handlePair} disabled={pairing || !pairingCode.trim()}>
                  {pairing ? t('admin.tools_desk.this_terminal.pairing') : t('admin.tools_desk.this_terminal.pair_button')}
                </Button>
              </div>
              {!window.electronAPI?.pairTerminal && (
                <p className="text-[11px] text-amber-600">{t('admin.tools_desk.this_terminal.desktop_only')}</p>
              )}
            </div>
          )}

          {/* Local printer preference */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              <PrinterIcon className="w-3.5 h-3.5" />
              {t('admin.tools_desk.this_terminal.printer_label')}
            </label>
            <select
              value={printer}
              onChange={(e) => setPrinter(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-secondary-500/30 focus:border-secondary-500 font-medium text-gray-800"
            >
              <option value="">{t('admin.tools_desk.this_terminal.printer_default')}</option>
              {printers.map((p: any, i: number) => (
                <option key={i} value={p.name}>{p.name}</option>
              ))}
              {printer && !printers.find((p: any) => p.name === printer) && (
                <option value={printer}>{printer}</option>
              )}
            </select>
            <p className="mt-1 text-xs text-gray-400">{t('admin.tools_desk.this_terminal.printer_helper')}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ReactivateProductTool({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const runSearch = useCallback(async (search: string) => {
    if (!search.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    try {
      const res = await productService.getProducts({ search, is_active: false, page: 1, limit: 20 });
      setResults(res.data);
    } catch {
      toast.error(t('admin.tools_desk.reactivate.load_failed'));
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [t]);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    runSearch(value);
  }, 300);

  const handleReactivate = async (product: Product) => {
    if (!window.confirm(t('admin.tools_desk.reactivate.confirm', { name: product.name }))) {
      return;
    }
    setBusyId(product.product_id);
    try {
      await productService.reactivateProduct(product.product_id);
      toast.success(t('admin.tools_desk.reactivate.success', { name: product.name }));
      setResults(prev => prev.filter(p => p.product_id !== product.product_id));
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('admin.tools_desk.reactivate.error'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-secondary-500 mb-3"
      >
        <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
        {t('admin.tools_desk.back')}
      </button>

      <Card className="border-2 border-gray-100 shadow-md">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <WrenchScrewdriverIcon className="w-4 h-4 text-secondary-500" />
            <h3 className="text-sm font-bold text-gray-900">{t('admin.tools_desk.tools.reactivate_product.title')}</h3>
          </div>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <MagnifyingGlassIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              autoFocus
              placeholder={t('admin.tools_desk.reactivate.search_placeholder')}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                debouncedSearch(e.target.value);
              }}
              className="w-full pl-10 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all bg-white font-medium"
            />
          </div>

          <div className="mt-3 space-y-2">
            {searching && (
              <p className="text-xs text-gray-500 text-center py-4">{t('admin.tools_desk.reactivate.searching')}</p>
            )}
            {!searching && searched && results.length === 0 && (
              <EmptyState
                icon={<ArrowPathIcon className="w-12 h-12" />}
                title={t('admin.tools_desk.reactivate.empty_title')}
                description={t('admin.tools_desk.reactivate.empty_description')}
              />
            )}
            {!searching && results.map(product => (
              <div
                key={product.product_id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-gray-200 bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gray-900 truncate">{product.name}</div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                    {product.sku && <span className="font-mono">{product.sku}</span>}
                    {product.barcode && <span className="font-mono">{product.barcode}</span>}
                    <Badge variant="gray" size="sm">{product.product_type}</Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReactivate(product)}
                  disabled={busyId === product.product_id}
                >
                  {busyId === product.product_id
                    ? t('admin.tools_desk.reactivate.reactivating')
                    : t('admin.tools_desk.reactivate.reactivate_button')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
