import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLicenseStore } from '../store/licenseStore';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function TrialBanner() {
  const navigate = useNavigate();
  const { licenseStatus, recordCounts, limits, checkLicense } = useLicenseStore();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    checkLicense();
    // Check every hour
    const interval = setInterval(checkLicense, 3600000);
    return () => clearInterval(interval);
  }, [checkLicense]);

  // Don't show if dismissed, not trial, or no license status
  if (isDismissed || !licenseStatus || !licenseStatus.isTrial) {
    return null;
  }

  const usage = limits && recordCounts ? {
    products: { current: recordCounts.products, limit: limits.products },
    customers: { current: recordCounts.customers, limit: limits.customers },
    sales: { current: recordCounts.sales, limit: limits.sales },
  } : null;

  const getUsagePercentage = (current: number, limit: number) => {
    return Math.min(100, Math.round((current / limit) * 100));
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-orange-600';
    return 'text-yellow-700';
  };

  return (
    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-yellow-200 px-4 py-3 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-semibold text-yellow-900">
                Trial Mode: {licenseStatus.daysRemaining} {licenseStatus.daysRemaining === 1 ? 'day' : 'days'} remaining
              </span>
              {usage && (
                <div className="flex items-center gap-4 text-sm">
                  <span className={getUsageColor(getUsagePercentage(usage.products.current, usage.products.limit))}>
                    Products: {usage.products.current}/{usage.products.limit}
                  </span>
                  <span className={getUsageColor(getUsagePercentage(usage.customers.current, usage.customers.limit))}>
                    Customers: {usage.customers.current}/{usage.customers.limit}
                  </span>
                  <span className={getUsageColor(getUsagePercentage(usage.sales.current, usage.sales.limit))}>
                    Sales: {usage.sales.current}/{usage.sales.limit}
                  </span>
                </div>
              )}
            </div>
            {licenseStatus.daysRemaining <= 7 && (
              <p className="text-sm text-yellow-800 mt-1">
                Your trial expires soon. Upgrade to continue using all features.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              navigate('/admin?tab=license');
            }}
            className="px-4 py-1.5 text-sm font-medium text-yellow-900 bg-yellow-200 hover:bg-yellow-300 rounded-md transition-colors"
          >
            Upgrade
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-yellow-600 hover:text-yellow-800 rounded-md transition-colors"
            aria-label="Dismiss"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

