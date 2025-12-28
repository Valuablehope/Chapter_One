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
    <TableRow index={index} hoverClassName="hover:bg-sky-50/50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-sky-100 to-blue-100 rounded-lg">
            <UserGroupIcon className="w-5 h-5 text-sky-600" />
          </div>
          <div className="text-sm font-bold text-gray-900">
            {customer.full_name || <span className="text-gray-400">N/A</span>}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {customer.phone ? (
            <>
              <PhoneIcon className="w-4 h-4 text-sky-500" />
              <span className="font-medium">{customer.phone}</span>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {customer.email ? (
            <>
              <EnvelopeIcon className="w-4 h-4 text-sky-500" />
              <span className="font-medium">{customer.email}</span>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(customer.created_at).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-2">
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
