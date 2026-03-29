import { useState, FormEvent } from 'react';
import { licenseService } from '../services/licenseService';
import { useLicenseStore } from '../store/licenseStore';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface LicenseActivationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function LicenseActivation({ onSuccess, onCancel }: LicenseActivationProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { checkLicense } = useLicenseStore();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsLoading(true);

    try {
      const response = await licenseService.activateLicense(licenseKey);
      if (response.success) {
        setSuccess(true);
        await checkLicense();
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 1500);
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to activate license. Please check your license key.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-8">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Activate License</h2>
        <p className="text-gray-600 mb-6">
          Enter your yearly subscription license key to activate full access to all features.
        </p>

        {success ? (
          <div className="text-center py-8">
            <CheckCircleIcon className="h-16 w-16 text-secondary-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">License Activated!</h3>
            <p className="text-gray-600">Your license has been successfully activated.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="licenseKey" className="block text-sm font-medium text-gray-700 mb-2">
                License Key
              </label>
              <Input
                id="licenseKey"
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                required
                className="font-mono"
                disabled={isLoading}
              />
              <p className="mt-1 text-sm text-gray-500">
                Enter your 16-character license key (format: XXXX-XXXX-XXXX-XXXX)
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <XCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isLoading || !licenseKey.trim()}
                className="flex-1"
              >
                {isLoading ? 'Activating...' : 'Activate License'}
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
        )}

        <div className="mt-8 pt-4 border-t border-gray-200">
          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-xs text-gray-500 mb-2">Need help with your license?</p>
            <div className="flex items-center gap-2 text-green-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <a href="https://wa.me/96171282672" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-gray-900 hover:text-green-600 transition-colors">
                00 961 71 282 672
              </a>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
