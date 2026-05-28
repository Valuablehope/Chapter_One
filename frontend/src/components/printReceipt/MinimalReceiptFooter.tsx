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

  const poweredBy = (
    <p
      className="text-center text-[9px] mt-2"
      style={{ color: 'rgba(0,0,0,0.42)', letterSpacing: '0.05em' }}
    >
      {t('receipt.by_cubiq')}
    </p>
  );

  if (settings?.receipt_footer?.trim()) {
    return (
      <div className="text-center mt-2 pt-2 border-t border-black">
        <div className="text-[11px] text-black whitespace-pre-line leading-snug">
          {settings.receipt_footer}
        </div>
        {poweredBy}
      </div>
    );
  }

  return (
    <div className="text-center mt-2 pt-2 border-t border-black">
      <p className="font-bold text-[11px] text-black">
        {variant === 'restaurant' ? t('receipt.thank_you_restaurant') : t('receipt.thank_you_sale')}
      </p>
      {poweredBy}
    </div>
  );
}
