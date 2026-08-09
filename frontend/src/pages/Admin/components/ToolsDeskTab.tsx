import { useCallback, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import toast from 'react-hot-toast';
import {
  ArrowUturnLeftIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import EmptyState from '../../../components/ui/EmptyState';
import { productService, Product } from '../../../services/productService';
import { useTranslation } from '../../../i18n/I18nContext';

type ToolKey = 'reactivate_product';

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
          </div>
        </>
      )}

      {activeTool === 'reactivate_product' && (
        <ReactivateProductTool onBack={() => setActiveTool(null)} />
      )}
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
