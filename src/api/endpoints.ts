import { apiClient } from './apiClient';
import type {
  Category,
  LoginResponse,
  Order,
  Product,
  User,
} from '../types';

export interface LoginPayload {
  email: string;
  password: string;
  siteTag: string;
}

export interface CategoryPayload {
  name: string;
  description?: string;
  image?: {
    key: string;
    originalName: string;
  } | null;
}

export interface ProductPayload {
  name: string;
  description?: string;
  basePrice: number;
  priceAfterDiscount?: number;
  discountPercent?: number;
  category: string;
  productType: 'clothes' | 'book' | 'other';
  stock: number;
  variants?: { size: string; price: number; stock: number }[];
  attachments?: { key: string; originalName: string }[];
}

export async function login(payload: LoginPayload) {
  const { data } = await apiClient.post<LoginResponse>('/api/auth/login', payload);
  return data;
}

export async function fetchCategories() {
  const { data } = await apiClient.get<unknown>('/api/categories');
  return normalizeCategoryArray(data);
}

export async function createCategory(payload: CategoryPayload) {
  const { data } = await apiClient.post<Category>('/api/categories', payload);
  return data;
}

export async function updateCategory(id: string, payload: Partial<CategoryPayload>) {
  const { data } = await apiClient.patch<Category>(`/api/categories/${id}`, payload);
  return data;
}

export async function deleteCategory(id: string) {
  const { data } = await apiClient.delete(`/api/categories/${id}`);
  return data;
}

export async function fetchProducts() {
  const { data } = await apiClient.get<unknown>('/api/products');
  return normalizeProductArray(data);
}

export async function createProduct(payload: ProductPayload) {
  const { data } = await apiClient.post<Product>('/api/products', payload);
  return data;
}

export async function updateProduct(id: string, payload: Partial<ProductPayload>) {
  const { data } = await apiClient.patch<Product>(`/api/products/${id}`, payload);
  return data;
}

export async function deleteProduct(id: string) {
  const { data } = await apiClient.delete(`/api/products/${id}`);
  return data;
}

export async function fetchOrders() {
  const { data } = await apiClient.get<Order[]>('/api/orders/admin/all');
  return data;
}

export async function cancelOrderRequest(id: string) {
  const { data } = await apiClient.post(`/api/orders/admin/${id}/cancel`);
  return data;
}

export async function uploadTempMedia(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post('/api/media/upload/temp', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as { key: string; originalName: string; url?: string };
}

export async function deleteMedia(key: string) {
  const { data } = await apiClient.delete(`/api/media/${key}`);
  return data;
}

export type { User };

function normalizeCategoryArray(payload: unknown): Category[] {
  return normalizeArray<Category>(payload, ['categories', 'data', 'result']);
}

function normalizeProductArray(payload: unknown): Product[] {
  return normalizeArray<Product>(payload, ['products', 'data', 'result']);
}

function normalizeArray<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === 'object') {
    for (const key of keys) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value as T[];
      }

      if (value && typeof value === 'object') {
        const nested = normalizeArray<T>(value, keys);
        if (nested.length) {
          return nested;
        }
      }
    }
  }

  return [];
}
