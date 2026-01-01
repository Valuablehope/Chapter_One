import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Create axios instance
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies in requests
});

// Helper function to create a request with cancellation support
export function createCancellableRequest<T>(
  requestFn: (signal?: AbortSignal) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  return requestFn(signal);
}

// Note: Token is now stored in httpOnly cookie, so no need for Authorization header
// Cookies are automatically sent with withCredentials: true

// Store CSRF token from response headers
let csrfToken: string | null = null;

// Response interceptor to extract CSRF token and handle errors
api.interceptors.response.use(
  (response) => {
    // Extract CSRF token from response header (sent on GET requests)
    const token = response.headers['x-csrf-token'];
    if (token) {
      csrfToken = token;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear auth and redirect to login
      useAuthStore.getState().logout();
      window.location.href = '/login';
    } else if (error.response?.status === 403 && error.response?.data?.error?.message?.includes('CSRF')) {
      // CSRF token error - clear token and retry might be needed
      csrfToken = null;
    }
    return Promise.reject(error);
  }
);

// Request interceptor to add CSRF token to state-changing requests
api.interceptors.request.use(
  (config) => {
    // Add CSRF token to state-changing requests
    const method = config.method?.toUpperCase();
    if (csrfToken && method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;









