import api from './api';
import { generateDeviceFingerprint, getDeviceInfo } from '../utils/deviceFingerprint';

export interface LicenseStatus {
  isValid: boolean;
  subscriptionType: 'trial' | 'yearly' | 'lifetime';
  status: 'active' | 'expired' | 'suspended';
  expiryDate: string;
  daysRemaining: number;
  isTrial: boolean;
  isExpired: boolean;
}

export interface RecordCounts {
  products: number;
  customers: number;
  sales: number;
  purchases: number;
  suppliers: number;
  users: number;
}

export interface LicenseInfoResponse {
  success: boolean;
  data: {
    hasLicense: boolean;
    licenseStatus: LicenseStatus | null;
    recordCounts: RecordCounts | null;
    limits: RecordCounts | null;
  };
}

export interface ActivateLicenseRequest {
  licenseKey: string;
  deviceFingerprint: string;
  deviceName?: string;
  deviceInfo?: any;
}

export interface ActivateLicenseResponse {
  success: boolean;
  data: {
    message: string;
    license: any;
  };
}

export interface ValidateDeviceRequest {
  deviceFingerprint: string;
}

export interface ValidateDeviceResponse {
  success: boolean;
  data: {
    valid: boolean;
    message: string;
    license?: any;
  };
}

export const licenseService = {
  getLicenseInfo: async (): Promise<LicenseInfoResponse> => {
    const response = await api.get<LicenseInfoResponse>('/license/info');
    return response.data;
  },

  activateLicense: async (licenseKey: string): Promise<ActivateLicenseResponse> => {
    const deviceFingerprint = generateDeviceFingerprint();
    const deviceInfo = getDeviceInfo();
    const deviceName = `${navigator.platform} - ${navigator.userAgent.split(' ')[0]}`;

    const response = await api.post<ActivateLicenseResponse>('/license/activate', {
      licenseKey,
      deviceFingerprint,
      deviceName,
      deviceInfo,
    } as ActivateLicenseRequest);
    return response.data;
  },

  validateDevice: async (): Promise<ValidateDeviceResponse> => {
    const deviceFingerprint = generateDeviceFingerprint();
    const response = await api.post<ValidateDeviceResponse>('/license/validate', {
      deviceFingerprint,
    } as ValidateDeviceRequest);
    return response.data;
  },
};





