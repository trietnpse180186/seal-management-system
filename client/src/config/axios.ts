import axios from 'axios';
import { API_BASE_URL } from './api.config';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Request interceptor: Auto-attach Bearer token & rewrite hardcoded localhost URLs
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Rewrite hardcoded local API base URLs if present
    if (config.url && config.url.startsWith('http://localhost:5000')) {
      config.url = config.url.replace('http://localhost:5000', API_BASE_URL);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 unauthorized errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
