import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { clearSession, getSiteTag, getToken } from '../lib/storage';

const env = import.meta.env as ImportMetaEnv & Record<string, string | undefined>;
const baseURL = env.VITE_API_URL ?? env.VITE_API_BASE_URL ?? env.REACT_APP_API_URL ?? 'http://localhost:8081';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  const siteTag = getSiteTag();
  const bodySiteTag =
    config.data && typeof config.data === 'object' && 'siteTag' in config.data
      ? (config.data as { siteTag?: unknown }).siteTag
      : undefined;
  const requestSiteTag = siteTag ?? (typeof bodySiteTag === 'string' ? bodySiteTag : undefined);

  config.headers = AxiosHeaders.from(config.headers);

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  if (requestSiteTag) {
    config.headers.set('X-Site-Tag', requestSiteTag);
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
