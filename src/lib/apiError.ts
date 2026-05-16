import { isAxiosError } from 'axios';
import { toast } from 'sonner';

type ApiErrorBody = {
  status?: string;
  message?: string;
  error?: string;
};

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | string | undefined;
    if (data && typeof data === 'object') {
      if (typeof data.message === 'string' && data.message) return data.message;
      if (typeof data.error === 'string' && data.error) return data.error;
    }
    if (typeof data === 'string' && data) return data;
    if (error.message) return error.message;
  }

  return fallback;
}

export function showApiError(error: unknown) {
  toast.error(getApiErrorMessage(error));
}
