import api from './api';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: {
      userId: string;
      username: string;
      fullName: string;
      role: 'cashier' | 'manager' | 'admin';
    };
  };
}

export interface VerifyResponse {
  success: boolean;
  data: {
    user: {
      userId: string;
      username: string;
      role: string;
    };
  };
}

export interface RefreshResponse {
  success: boolean;
  data: {
    token: string;
    user: {
      userId: string;
      username: string;
      role: string;
    };
  };
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  verifyToken: async (): Promise<VerifyResponse> => {
    const response = await api.get<VerifyResponse>('/auth/verify');
    return response.data;
  },

  refreshToken: async (): Promise<RefreshResponse> => {
    const response = await api.post<RefreshResponse>('/auth/refresh');
    return response.data;
  },
};











