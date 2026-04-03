import { memo } from 'react';
import { Product } from '../../../services/productService';
import Badge from '../../../components/ui/Badge';
import { PencilIcon, TrashIcon, CubeIcon } from '@heroicons/react/24/outline';
import { TableRow } from '../../../components/shared/TableRow';
import { useTranslation } from '../../../i18n/I18nContext';

export interface ProductRowProps {
  product: Product;
  index: number;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  formatCurrency: (amount: number) => string;
  visibleColumns: string[];
  isCustomSized: boolean;
}

// Map product types to badge variants for color differentiation
// Each type has a clearly distinct color for easy visual identification
const getProductTypeVariant = (productType: string): 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'gray' => {
  if (!productType) return 'gray';
  
  // Assign a consistent deterministic color based on the string value
  const variants: Array<'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = [
    'primary', 'success', 'warning', 'info', 'error', 'secondary'
  ];
  
  let hash = 0;
  for (let i = 0; i < productType.length; i++) {
    hash = productType.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % variants.length;
  return variants[index];
};

export const ProductRow = memo<ProductRowProps>(({ product, index, onEdit, onDelete, formatCurrency, visibleColumns, isCustomSized }) => {
  const { t, language } = useTranslation();
  const locale = language === 'ar' ? 'ar-EG' : 'en-US';
  const cellClass = `px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis ${isCustomSized ? 'max-w-0' : ''}`;

  return (
    <TableRow index={index} hoverClassName="hover:bg-secondary-50/50">
      {visibleColumns.includes('name') && (
        <td className={cellClass}>
          <div className="flex items-center space-x-2 truncate">
            <div className="p-1.5 bg-secondary-100 rounded-lg flex-shrink-0">
              <CubeIcon className="w-3.5 h-3.5 text-secondary-500" />
            </div>
            <div className="text-xs font-bold text-gray-900 truncate">{product.name}</div>
          </div>
        </td>
      )}
      {visibleColumns.includes('sku') && (
        <td className={cellClass}>
            <div className="text-xs text-gray-600 font-mono truncate">
              {product.sku || <span className="text-gray-400">{t('products.common.empty_value')}</span>}
            </div>
        </td>
      )}
      {visibleColumns.includes('barcode') && (
        <td className={cellClass}>
            <div className="text-xs text-gray-600 font-mono truncate">
              {product.barcode || <span className="text-gray-400">{t('products.common.empty_value')}</span>}
            </div>
        </td>
      )}
      {visibleColumns.includes('type') && (
        <td className={cellClass}>
          <Badge variant={getProductTypeVariant(product.product_type)} size="sm">{product.product_type}</Badge>
        </td>
      )}
      {visibleColumns.includes('unit') && (
        <td className={cellClass}>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200 truncate">
              {product.unit_of_measure || t('products.units.each')}
            </span>
        </td>
      )}
      {visibleColumns.includes('list_price') && (
        <td className={cellClass}>
            <div className="text-xs font-semibold text-gray-900 truncate">
              {product.list_price ? formatCurrency(Number(product.list_price)) : <span className="text-gray-400">{t('products.common.empty_value')}</span>}
            </div>
        </td>
      )}
      {visibleColumns.includes('sale_price') && (
        <td className={cellClass}>
            <div className="text-xs font-bold text-secondary-500 truncate">
              {product.sale_price ? formatCurrency(Number(product.sale_price)) : <span className="text-gray-400">{t('products.common.empty_value')}</span>}
            </div>
        </td>
      )}
      {visibleColumns.includes('inventory') && (
        <td className={cellClass}>
          <Badge variant={product.track_inventory ? 'success' : 'gray'} size="sm">
            {product.track_inventory ? t('products.badges.tracked') : t('products.badges.not_tracked')}
          </Badge>
        </td>
      )}
      {visibleColumns.includes('qty_in') && (
        <td className={cellClass}>
            <div className="text-xs font-semibold text-green-600 truncate">
              {product.qty_in !== undefined ? product.qty_in.toLocaleString(locale) : <span className="text-gray-400">{t('products.common.empty_value')}</span>}
            </div>
        </td>
      )}
      {visibleColumns.includes('qty_out') && (
        <td className={cellClass}>
            <div className="text-xs font-semibold text-red-600 truncate">
              {product.qty_out !== undefined ? product.qty_out.toLocaleString(locale) : <span className="text-gray-400">{t('products.common.empty_value')}</span>}
            </div>
        </td>
      )}
      {visibleColumns.includes('balance') && (
        <td className={cellClass}>
          <div className={`text-xs font-bold truncate ${product.balance !== undefined && product.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {product.balance !== undefined ? product.balance.toLocaleString(locale) : <span className="text-gray-400">{t('products.common.empty_value')}</span>}
          </div>
        </td>
      )}
      {visibleColumns.includes('actions') && (
        <td className={`px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis text-right min-w-[80px] ${isCustomSized ? 'max-w-0' : ''}`}>
          <div className="flex items-center justify-end gap-1 float-right">
            <button
              title={t('products.actions.edit')}
              aria-label={t('products.actions.edit')}
              onClick={() => onEdit(product)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              title={t('products.actions.delete_short')}
              aria-label={t('products.actions.delete_short')}
              onClick={() => onDelete(product)}
              className="p-1.5 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </td>
      )}
    </TableRow>
  );
});

ProductRow.displayName = 'ProductRow';
