import { memo } from 'react';
import { Customer } from '../../../services/customerService';
import { PencilIcon, TrashIcon, UserGroupIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { TableRow } from '../../../components/shared/TableRow';
import { useTranslation } from '../../../i18n/I18nContext';

export interface CustomerRowProps {
  customer: Customer;
  index: number;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}

export const CustomerRow = memo<CustomerRowProps>(({ customer, index, onEdit, onDelete }) => {
  const { t, language } = useTranslation();
  return (
    <TableRow index={index} hoverClassName="hover:bg-secondary-50/50">
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center space-x-1.5">
          <div className="p-1.5 bg-secondary-100 rounded-lg">
            <UserGroupIcon className="w-3.5 h-3.5 text-secondary-500" />
          </div>
          <div className="text-xs font-bold text-gray-900">
            {customer.full_name || <span className="text-gray-400">{t('customers.common.not_available')}</span>}
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
            <span className="text-gray-400">{t('customers.common.empty_value')}</span>
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
            <span className="text-gray-400">{t('customers.common.empty_value')}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
        {new Date(customer.created_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            title={t('customers.actions.edit')}
            aria-label={t('customers.actions.edit')}
            onClick={() => onEdit(customer)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            title={t('customers.actions.delete')}
            aria-label={t('customers.actions.delete')}
            onClick={() => onDelete(customer)}
            className="p-1.5 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </TableRow>
  );
});

CustomerRow.displayName = 'CustomerRow';
