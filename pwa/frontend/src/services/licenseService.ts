import api from './api';

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
    storeId: string | null;
  };
}

export interface ConvexActivateRequest {
  licenseKey: string;
}

export interface ConvexActivateResponse {
  success: boolean;
  data: {
    message: string;
    validUntil: string;
    plan: string;
    validFrom: string;
  };
}

export interface MobileSession {
  sessionId: string;
  username: string;
  fullName?: string;
  role: string;
  deviceName?: string;
  createdAt: number;
  expiresAt: number;
}

export const licenseService = {
  getLicenseInfo: async (): Promise<LicenseInfoResponse> => {
    const response = await api.get<LicenseInfoResponse>('/license/info');
    return response.data;
  },

  convexActivate: async (req: ConvexActivateRequest): Promise<ConvexActivateResponse> => {
    const response = await api.post<ConvexActivateResponse>('/license/convex-activate', req);
    return response.data;
  },

  listMobileSessions: async (): Promise<MobileSession[]> => {
    const response = await api.get<{ success: boolean; data: { sessions: MobileSession[] } }>('/license/mobile-sessions');
    return response.data.data.sessions;
  },

  revokeMobileSession: async (sessionId: string): Promise<void> => {
    await api.post(`/license/mobile-sessions/${sessionId}/revoke`);
  },
};





