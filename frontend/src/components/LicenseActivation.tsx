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
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
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
      </div>
    </Card>
  );
}

