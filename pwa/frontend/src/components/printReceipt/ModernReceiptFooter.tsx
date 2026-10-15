import type { StoreSettings } from '../../services/storeService';
import { useTranslation } from '../../i18n/I18nContext';

type FooterVariant = 'sale' | 'restaurant';

export function ModernReceiptFooter({
  settings,
  variant = 'sale',
}: {
  settings: StoreSettings | null;
  variant?: FooterVariant;
}) {
  const { t } = useTranslation();

  const poweredBy = (
    <p className="text-center text-[10px] mt-2 text-gray-400">{t('receipt.by_cubiq')}</p>
  );

  if (settings?.receipt_footer?.trim()) {
    return (
      <div className="text-center mt-3 pt-3 border-t border-dashed border-gray-400">
        <div className="text-[13px] text-gray-700 whitespace-pre-line leading-relaxed">
          {settings.receipt_footer}
        </div>
        {poweredBy}
      </div>
    );
  }

  return (
    <div className="text-center mt-3 pt-3 border-t border-dashed border-gray-400">
      <p className="font-semibold text-[13px] text-gray-800">
        {variant === 'restaurant' ? t('receipt.thank_you_restaurant') : t('receipt.thank_you_sale')}
      </p>
      {poweredBy}
    </div>
  );
}
