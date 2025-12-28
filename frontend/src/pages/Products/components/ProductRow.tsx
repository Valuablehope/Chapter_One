import { memo } from 'react';
import { Product } from '../../../services/productService';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { PencilIcon, TrashIcon, CubeIcon } from '@heroicons/react/24/outline';
import { TableRow } from '../../../components/shared/TableRow';

export interface ProductRowProps {
  product: Product;
  index: number;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  formatCurrency: (amount: number) => string;
}

export const ProductRow = memo<ProductRowProps>(({ product, index, onEdit, onDelete, formatCurrency }) => {
  return (
    <TableRow index={index} hoverClassName="hover:bg-emerald-50/50">
      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg">
            <CubeIcon className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-sm font-bold text-gray-900">{product.name}</div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-600 font-mono">
          {product.sku || <span className="text-gray-400">-</span>}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-600 font-mono">
          {product.barcode || <span className="text-gray-400">-</span>}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden lg:table-cell">
        <Badge variant="primary" size="sm">{product.product_type}</Badge>
      </td>
      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
        <div className="text-sm font-semibold text-gray-900">
          {product.list_price ? formatCurrency(Number(product.list_price)) : <span className="text-gray-400">-</span>}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
        <div className="text-sm font-bold text-emerald-600">
          {product.sale_price ? formatCurrency(Number(product.sale_price)) : <span className="text-gray-400">-</span>}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
        <Badge variant={product.track_inventory ? 'success' : 'gray'} size="sm">
          {product.track_inventory ? 'Tracked' : 'Not Tracked'}
        </Badge>
      </td>
      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() => onEdit(product)}
            variant="ghost"
            size="sm"
            leftIcon={<PencilIcon className="w-4 h-4" />}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Edit
          </Button>
          <Button
            onClick={() => onDelete(product)}
            variant="danger"
            size="sm"
            leftIcon={<TrashIcon className="w-4 h-4" />}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Delete
          </Button>
        </div>
      </td>
    </TableRow>
  );
});

ProductRow.displayName = 'ProductRow';
