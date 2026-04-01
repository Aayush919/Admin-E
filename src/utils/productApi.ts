import { apiClient } from '../api/apiClient';
import type { Product } from '../types';

export type ProductTypeFilter = Product['productType'] | 'all';

export interface ProductFilters {
  search?: string;
  category?: string;
  productType?: ProductTypeFilter;
  isFeatured?: boolean | 'all';
  page?: number;
  limit?: number;
}

export interface ProductListResult {
  products: Product[];
  total: number;
  page: number;
  limit: number;
}

type FeaturedProductIds = string | string[];

export async function getProducts(siteTag: string, filters: ProductFilters = {}) {
  const { data } = await apiClient.get<unknown>('/api/products', {
    params: sanitizeFilters(filters),
    headers: {
      'X-Site-Tag': siteTag,
    },
  });

  return normalizeListResult(data);
}

export async function getProductById(id: string, siteTag: string) {
  const { data } = await apiClient.get<unknown>(`/api/products/${id}`, {
    headers: {
      'X-Site-Tag': siteTag,
    },
  });

  return normalizeProduct(data);
}

export async function createProduct(formData: FormData, siteTag: string, token: string) {
  const { data } = await apiClient.post<unknown>('/api/products', formData, {
    headers: {
      'X-Site-Tag': siteTag,
      Authorization: `Bearer ${token}`,
    },
  });

  return normalizeProduct(data);
}

export async function updateProduct(id: string, formData: FormData, siteTag: string, token: string) {
  const { data } = await apiClient.patch<unknown>(`/api/products/${id}`, formData, {
    headers: {
      'X-Site-Tag': siteTag,
      Authorization: `Bearer ${token}`,
    },
  });

  return normalizeProduct(data);
}

export async function deleteProduct(id: string, siteTag: string, token: string) {
  const { data } = await apiClient.delete<unknown>(`/api/products/${id}`, {
    headers: {
      'X-Site-Tag': siteTag,
      Authorization: `Bearer ${token}`,
    },
  });

  return data;
}

export async function getFeaturedProducts(siteTag: string, token: string) {
  const { data } = await apiClient.get<unknown>('/api/products/admin/featured', {
    headers: {
      'X-Site-Tag': siteTag,
      Authorization: `Bearer ${token}`,
    },
  });

  return normalizeListResult(data);
}

export async function updateFeaturedProducts(
  productIds: FeaturedProductIds,
  isFeatured: boolean,
  siteTag: string,
  token: string,
) {
  const { data } = await apiClient.patch<unknown>(
    '/api/products/admin/featured',
    { productIds, isFeatured },
    {
      headers: {
        'X-Site-Tag': siteTag,
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return data;
}

function sanitizeFilters(filters: ProductFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== '' && value !== 'all'),
  );
}

function normalizeListResult(payload: unknown): ProductListResult {
  const products = normalizeProductArray(payload);
  const metaSource = findObject(payload);
  const total = numberFrom(metaSource, ['total', 'count', 'totalCount'], products.length);
  const page = numberFrom(metaSource, ['page', 'currentPage'], 1);
  const limit = numberFrom(metaSource, ['limit', 'pageSize', 'perPage'], products.length || 10);

  return {
    products,
    total,
    page,
    limit,
  };
}

function normalizeProductArray(payload: unknown): Product[] {
  if (Array.isArray(payload)) {
    return payload as Product[];
  }

  if (payload && typeof payload === 'object') {
    const candidates = ['products', 'data', 'result', 'items', 'docs'];
    for (const key of candidates) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value as Product[];
      }

      const nested = normalizeProductArray(value);
      if (nested.length) {
        return nested;
      }
    }
  }

  return [];
}

function normalizeProduct(payload: unknown): Product {
  if (payload && typeof payload === 'object') {
    const candidates = ['product', 'data', 'result', 'item'];
    for (const key of candidates) {
      const value = (payload as Record<string, unknown>)[key];
      if (value && typeof value === 'object' && '_id' in value) {
        return value as Product;
      }
    }

    if ('_id' in payload) {
      return payload as Product;
    }
  }

  return {} as Product;
}

function findObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (record.products || record.data || record.result || record.items || record.docs) {
    return record;
  }

  for (const key of ['data', 'result', 'product', 'items', 'docs']) {
    const nested = findObject(record[key]);
    if (nested) {
      return nested;
    }
  }

  return record;
}

function numberFrom(source: Record<string, unknown> | null, keys: string[], fallback: number) {
  if (!source) return fallback;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return fallback;
}
