import { useState, useRef, FormEvent } from 'react';
import { licenseService } from '../services/licenseService';
import { useLicenseStore } from '../store/licenseStore';
import Button from './ui/Button';
import {
  CheckCircleIcon,
  XCircleIcon,
  KeyIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface LicenseActivationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}


function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function LicenseActivation({ onSuccess, onCancel }: LicenseActivationProps) {
  const [licenseKey, setLicenseKey]   = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState('');
  const [successData, setSuccessData] = useState<{ validUntil: string; plan: string } | null>(null);
  const submittingRef                 = useRef(false);
  const { checkLicense }              = useLicenseStore();

  const handleInput = (raw: string) => {
    // Format: CH1-XXXX-XXXX-XXXX-XXXX (3 + 4×4 = 19 alphanumeric chars)
    const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 19);
    const sizes = [3, 4, 4, 4, 4];
    const parts: string[] = [];
    let idx = 0;
    for (const size of sizes) {
      if (idx >= clean.length) break;
      parts.push(clean.slice(idx, idx + size));
      idx += size;
    }
    setLicenseKey(parts.join('-'));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingRef.current || isLoading) return;

    const trimmed = licenseKey.trim();
    if (!trimmed) {
      setError('Please enter a license key.');
      return;
    }

    submittingRef.current = true;
    setError('');
    setIsLoading(true);

    try {
      const response = await licenseService.convexActivate({ licenseKey: trimmed });

      if (response.success) {
        setSuccessData({ validUntil: response.data.validUntil, plan: response.data.plan });
        setLicenseKey('');
        await checkLicense();
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 2000);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
        'License activation failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  if (successData) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="h-9 w-9 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">License Activated!</h3>
        <p className="text-sm text-gray-600 mb-1">Your license has been successfully activated.</p>
        <p className="text-xs font-semibold text-secondary-600 mt-3">
          Valid until <span className="font-bold">{formatDate(successData.validUntil)}</span>
        </p>
        <div className="mt-1">
          <span className="inline-block px-3 py-0.5 text-xs font-semibold rounded-full bg-secondary-100 text-secondary-700 capitalize">
            {successData.plan}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 shrink-0">
          <KeyIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">Activate License</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Enter your license key to activate full access. The key can only be used once.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="licenseKey" className="block text-xs font-semibold text-gray-700 mb-1.5">
            License Key
          </label>
          <input
            id="licenseKey"
            type="text"
            value={licenseKey}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="CH1-XXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            disabled={isLoading}
            className="w-full px-3 py-2.5 text-sm font-mono tracking-widest border-2 border-gray-200 rounded-xl
                       bg-white text-gray-900 placeholder-gray-400
                       focus:outline-none focus:border-secondary-400 focus:ring-0
                       disabled:opacity-50 disabled:bg-gray-50 transition-colors"
          />
          <p className="mt-1 text-xs text-gray-400">Format: CH1-XXXX-XXXX-XXXX-XXXX</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <XCircleIcon className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 font-medium">{error}</p>
          </div>
        )}

        <div className="flex gap-2.5 pt-1">
          <Button
            type="submit"
            disabled={isLoading || !licenseKey.trim()}
            className="flex-1"
            leftIcon={
              isLoading
                ? <ArrowPathIcon className="w-4 h-4 animate-spin" />
                : <KeyIcon className="w-4 h-4" />
            }
          >
            {isLoading ? 'Activating…' : 'Activate License'}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>

      <div className="pt-3 border-t border-gray-100 flex items-center justify-center gap-2">
        <svg className="w-4 h-4 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        <a
          href="https://wa.me/96171282672"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-gray-700 hover:text-green-600 transition-colors"
        >
          Need help? 00 961 71 282 672
        </a>
      </div>
    </div>
  );
}
