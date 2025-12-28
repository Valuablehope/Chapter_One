import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { licenseService, LicenseStatus, RecordCounts } from '../services/licenseService';
import { logger } from '../utils/logger';

interface LicenseState {
  licenseStatus: LicenseStatus | null;
  recordCounts: RecordCounts | null;
  limits: RecordCounts | null;
  lastChecked: string | null;
  isLoading: boolean;
  error: string | null;
  checkLicense: () => Promise<void>;
  setLicenseStatus: (status: LicenseStatus | null) => void;
  setRecordCounts: (counts: RecordCounts | null) => void;
  setLimits: (limits: RecordCounts | null) => void;
  clearLicense: () => void;
}

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set, get) => ({
      licenseStatus: null,
      recordCounts: null,
      limits: null,
      lastChecked: null,
      isLoading: false,
      error: null,
      checkLicense: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await licenseService.getLicenseInfo();
          if (response.success) {
            set({
              licenseStatus: response.data.licenseStatus,
              recordCounts: response.data.recordCounts,
              limits: response.data.limits,
              lastChecked: new Date().toISOString(),
              isLoading: false,
            });
          } else {
            set({ isLoading: false, error: 'Failed to fetch license info' });
          }
        } catch (error: any) {
          logger.error('Failed to check license:', error);
          set({
            isLoading: false,
            error: error.response?.data?.error?.message || 'Failed to check license',
          });
        }
      },
      setLicenseStatus: (status) => set({ licenseStatus: status }),
      setRecordCounts: (counts) => set({ recordCounts: counts }),
      setLimits: (limits) => set({ limits }),
      clearLicense: () => set({
        licenseStatus: null,
        recordCounts: null,
        limits: null,
        lastChecked: null,
        error: null,
      }),
    }),
    {
      name: 'license-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);



