import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLicenseStore } from '../store/licenseStore';
import { useAuthStore } from '../store/authStore';
import { LockClosedIcon } from '@heroicons/react/24/outline';

export default function LicenseBanner() {
  const navigate = useNavigate();
  const { licenseStatus, lastChecked, isLoading, checkLicense } = useLicenseStore();
  const { user } = useAuthStore();

  useEffect(() => {
    checkLicense();
    const interval = setInterval(checkLicense, 3600000);
    return () => clearInterval(interval);
  }, [checkLicense]);

  const hasChecked = lastChecked !== null;
  const isInvalid = hasChecked && !isLoading && (!licenseStatus || !licenseStatus.isValid);

  if (!isInvalid) return null;

  const isExpired = licenseStatus?.isExpired ?? false;
  const isAdmin = user?.role === 'admin';

  return (
    <div className="bg-gradient-to-r from-red-900 to-red-800 border-b border-red-700 px-4 py-3 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <LockClosedIcon className="h-5 w-5 text-red-200 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-white">View Only Mode</span>
            <span className="text-red-200 ml-2 text-sm">
              {isExpired
                ? 'Your license has expired. Renew your license to restore full access.'
                : 'No valid license found. Activate a license to unlock all features.'}
            </span>
            {!isAdmin && (
              <span className="text-red-300 text-sm ml-1">
                Contact your administrator to activate a license.
              </span>
            )}
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => navigate('/admin?tab=license')}
            className="px-4 py-1.5 text-sm font-medium text-red-900 bg-white hover:bg-red-50 rounded-md transition-colors whitespace-nowrap flex-shrink-0"
          >
            {isExpired ? 'Renew License' : 'Activate License'}
          </button>
        )}
      </div>
    </div>
  );
}
