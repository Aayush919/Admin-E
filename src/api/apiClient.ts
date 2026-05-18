import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { clearSession, getToken, resolveSiteTag } from '../lib/storage';

const env = import.meta.env as ImportMetaEnv & Record<string, string | undefined>;
const baseURL = env.VITE_API_URL ?? env.VITE_API_BASE_URL ?? env.REACT_APP_API_URL ?? 'https://api.thakurjishringar.com';

type ApiResponseBody = {
  status?: string;
  message?: string;
  error?: string;
};

function extractMessage(data: ApiResponseBody | undefined): string {
  if (!data) return 'Request failed';
  if (typeof data.message === 'string' && data.message) return data.message;
  if (typeof data.error === 'string' && data.error) return data.error;
  return 'Request failed';
}

function isFailureStatus(status?: string): boolean {
  return status === 'error' || status === 'fail';
}

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  const siteTag = resolveSiteTag();

  config.headers = AxiosHeaders.from(config.headers);

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  config.headers.set('x-site-tag', siteTag);

  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResponseBody | undefined;

    if (data && typeof data === 'object' && isFailureStatus(data.status)) {
      return Promise.reject(new Error(extractMessage(data)));
    }

    return response;
  },
  (error: AxiosError<ApiResponseBody | string>) => {
    if (error.response?.status === 401) {
      clearSession();
    }

    const data = error.response?.data;
    if (data && typeof data === 'object') {
      return Promise.reject(new Error(extractMessage(data)));
    }

    if (typeof data === 'string' && data) {
      return Promise.reject(new Error(data));
    }

    return Promise.reject(error);
  },
);
