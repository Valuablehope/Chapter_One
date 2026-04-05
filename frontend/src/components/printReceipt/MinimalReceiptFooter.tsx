import type { StoreSettings } from '../../services/storeService';
import { useTranslation } from '../../i18n/I18nContext';

type FooterVariant = 'sale' | 'restaurant';

export function MinimalReceiptFooter({
  settings,
  variant = 'sale',
}: {
  settings: StoreSettings | null;
  variant?: FooterVariant;
}) {
  const { t } = useTranslation();

  const cubiq = (
    <p className="text-center text-[10px] text-black/70 mt-2 pt-1 print:text-black/80">
      {t('receipt.by_cubiq')}
    </p>
  );

  if (settings?.receipt_footer?.trim()) {
    return (
      <>
        <div className="text-center text-xs text-black whitespace-pre-line mt-2 pt-2 border-t border-black leading-snug">
          {settings.receipt_footer}
        </div>
        {cubiq}
      </>
    );
  }

  return (
    <>
      <div className="text-center text-xs text-black mt-2 pt-2 border-t border-black">
        <p className="font-semibold">
          {variant === 'restaurant' ? t('receipt.thank_you_restaurant') : t('receipt.thank_you_sale')}
        </p>
      </div>
      {cubiq}
    </>
  );
}
