import { memo } from 'react';
import { Supplier } from '../../../services/supplierService';
import { PencilIcon, TrashIcon, BuildingOfficeIcon, PhoneIcon, EnvelopeIcon, UserIcon } from '@heroicons/react/24/outline';
import { TableRow } from '../../../components/shared/TableRow';
import { useTranslation } from '../../../i18n/I18nContext';

export interface SupplierRowProps {
  supplier: Supplier;
  index: number;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
}

export const SupplierRow = memo<SupplierRowProps>(({ supplier, index, onEdit, onDelete }) => {
  const { t, language } = useTranslation();
  return (
    <TableRow index={index} hoverClassName="hover:bg-secondary-50/50">
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center space-x-1.5">
          <div className="p-1.5 bg-secondary-100 rounded-lg">
            <BuildingOfficeIcon className="w-3.5 h-3.5 text-secondary-500" />
          </div>
          <div className="text-xs font-bold text-gray-900">{supplier.name}</div>
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          {supplier.contact_name ? (
            <>
              <UserIcon className="w-3.5 h-3.5 text-secondary-500" />
              <span className="font-medium">{supplier.contact_name}</span>
            </>
          ) : (
            <span className="text-gray-400">{t('suppliers.common.empty_value')}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          {supplier.phone ? (
            <>
              <PhoneIcon className="w-3.5 h-3.5 text-secondary-500" />
              <span className="font-medium">{supplier.phone}</span>
            </>
          ) : (
            <span className="text-gray-400">{t('suppliers.common.empty_value')}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          {supplier.email ? (
            <>
              <EnvelopeIcon className="w-3.5 h-3.5 text-secondary-500" />
              <span className="font-medium">{supplier.email}</span>
            </>
          ) : (
            <span className="text-gray-400">{t('suppliers.common.empty_value')}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
        {new Date(supplier.created_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            title={t('suppliers.actions.edit')}
            aria-label={t('suppliers.actions.edit')}
            onClick={() => onEdit(supplier)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            title={t('suppliers.actions.delete')}
            aria-label={t('suppliers.actions.delete')}
            onClick={() => onDelete(supplier)}
            className="p-1.5 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </TableRow>
  );
});

SupplierRow.displayName = 'SupplierRow';
