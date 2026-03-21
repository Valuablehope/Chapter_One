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

export const ProductRow = memo<ProductRowProps>(({ product, index, onEdit, onDelete, formatCurrency }) => {
  return (
    <TableRow index={index} hoverClassName="hover:bg-secondary-50/50">
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-secondary-100 rounded-lg">
            <CubeIcon className="w-3.5 h-3.5 text-secondary-500" />
          </div>
          <div className="text-xs font-bold text-gray-900">{product.name}</div>
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="text-xs text-gray-600 font-mono">
          {product.sku || <span className="text-gray-400">-</span>}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="text-xs text-gray-600 font-mono">
          {product.barcode || <span className="text-gray-400">-</span>}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap hidden lg:table-cell">
        <Badge variant={getProductTypeVariant(product.product_type)} size="sm">{product.product_type}</Badge>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="text-xs font-semibold text-gray-900">
          {product.list_price ? formatCurrency(Number(product.list_price)) : <span className="text-gray-400">-</span>}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="text-xs font-bold text-secondary-500">
          {product.sale_price ? formatCurrency(Number(product.sale_price)) : <span className="text-gray-400">-</span>}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap hidden sm:table-cell">
        <Badge variant={product.track_inventory ? 'success' : 'gray'} size="sm">
          {product.track_inventory ? 'Tracked' : 'Not Tracked'}
        </Badge>
      </td>
      <td className="px-3 py-2 whitespace-nowrap hidden md:table-cell">
        <div className="text-xs font-semibold text-green-600">
          {product.qty_in !== undefined ? product.qty_in.toLocaleString() : <span className="text-gray-400">-</span>}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap hidden md:table-cell">
        <div className="text-xs font-semibold text-red-600">
          {product.qty_out !== undefined ? product.qty_out.toLocaleString() : <span className="text-gray-400">-</span>}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap hidden md:table-cell">
        <div className={`text-xs font-bold ${product.balance !== undefined && product.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {product.balance !== undefined ? product.balance.toLocaleString() : <span className="text-gray-400">-</span>}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1.5">
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
