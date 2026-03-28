import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { getSiteTag, getToken, clearSession } from '../lib/storage';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  const siteTag = getSiteTag();

  config.headers = AxiosHeaders.from(config.headers);

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  const isAuthRoute = typeof config.url === 'string' && config.url.includes('/api/auth/');
  if (siteTag && !isAuthRoute) {
    config.headers.set('x-site-tag', siteTag);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const data = response.data as { status?: string; message?: string } | undefined;

    if (data && typeof data === 'object' && data.status === 'error') {
      const apiError = new Error(data.message || 'Request failed') as Error & {
        response?: typeof response;
        isApiError?: boolean;
      };
      apiError.response = response;
      apiError.isApiError = true;
      return Promise.reject(apiError);
    }

    return response;
  },
  (error: AxiosError<{ status?: string; message?: string }>) => {
    if (error.response?.status === 401) {
      clearSession();
    }
    return Promise.reject(error);
  },
);
