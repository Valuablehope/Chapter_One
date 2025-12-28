import { memo } from 'react';
import { Supplier } from '../../../services/supplierService';
import Button from '../../../components/ui/Button';
import { PencilIcon, TrashIcon, BuildingOfficeIcon, PhoneIcon, EnvelopeIcon, UserIcon } from '@heroicons/react/24/outline';
import { TableRow } from '../../../components/shared/TableRow';

export interface SupplierRowProps {
  supplier: Supplier;
  index: number;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
}

export const SupplierRow = memo<SupplierRowProps>(({ supplier, index, onEdit, onDelete }) => {
  return (
    <TableRow index={index} hoverClassName="hover:bg-indigo-50/50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-lg">
            <BuildingOfficeIcon className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-sm font-bold text-gray-900">{supplier.name}</div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {supplier.contact_name ? (
            <>
              <UserIcon className="w-4 h-4 text-indigo-500" />
              <span className="font-medium">{supplier.contact_name}</span>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {supplier.phone ? (
            <>
              <PhoneIcon className="w-4 h-4 text-indigo-500" />
              <span className="font-medium">{supplier.phone}</span>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {supplier.email ? (
            <>
              <EnvelopeIcon className="w-4 h-4 text-indigo-500" />
              <span className="font-medium">{supplier.email}</span>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(supplier.created_at).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() => onEdit(supplier)}
            variant="ghost"
            size="sm"
            leftIcon={<PencilIcon className="w-4 h-4" />}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Edit
          </Button>
          <Button
            onClick={() => onDelete(supplier)}
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

SupplierRow.displayName = 'SupplierRow';
