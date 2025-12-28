import { memo } from 'react';
import { Customer } from '../../../services/customerService';
import Button from '../../../components/ui/Button';
import { PencilIcon, TrashIcon, UserGroupIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { TableRow } from '../../../components/shared/TableRow';

export interface CustomerRowProps {
  customer: Customer;
  index: number;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}

export const CustomerRow = memo<CustomerRowProps>(({ customer, index, onEdit, onDelete }) => {
  return (
    <TableRow index={index} hoverClassName="hover:bg-secondary-50/50">
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center space-x-1.5">
          <div className="p-1.5 bg-secondary-100 rounded-lg">
            <UserGroupIcon className="w-3.5 h-3.5 text-secondary-500" />
          </div>
          <div className="text-xs font-bold text-gray-900">
            {customer.full_name || <span className="text-gray-400">N/A</span>}
          </div>
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          {customer.phone ? (
            <>
              <PhoneIcon className="w-3.5 h-3.5 text-secondary-500" />
              <span className="font-medium">{customer.phone}</span>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          {customer.email ? (
            <>
              <EnvelopeIcon className="w-3.5 h-3.5 text-secondary-500" />
              <span className="font-medium">{customer.email}</span>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
        {new Date(customer.created_at).toLocaleDateString()}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            onClick={() => onEdit(customer)}
            variant="ghost"
            size="sm"
            leftIcon={<PencilIcon className="w-4 h-4" />}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Edit
          </Button>
          <Button
            onClick={() => onDelete(customer)}
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

CustomerRow.displayName = 'CustomerRow';
