import { apiClient } from './apiClient';
import type {
  Category,
  Coupon,
  CreateCouponPayload,
  CustomerOption,
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
  price?: number;
  priceAfterDiscount?: number;
  discountPercentage?: number;
  category: string;
  productType: 'clothes' | 'book' | 'other';
  stock?: number;
  sizeVariants?: Array<{
    size: string | number;
    price: number;
    priceAfterDiscount?: number;
    discountPercentage?: number;
    stock: number;
  }>;
  attachments?: Array<{
    key: string;
    originalName: string;
  }>;
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

export async function getProductDetails(productId: string, size?: string | number) {
  const { data } = await apiClient.get<unknown>(
    `/api/products/${productId}${size ? `?size=${size}` : ''}`
  );
  return normalizeProduct(data);
}

export async function searchProducts(query: string) {
  const { data } = await apiClient.get<unknown>(`/api/products/search?q=${query}`);
  return normalizeProductArray(data);
}

export async function getProductsByCategory(categoryId: string) {
  const { data } = await apiClient.get<unknown>(`/api/products/category/${categoryId}`);
  return normalizeProductArray(data);
}

export async function createProduct(payload: ProductPayload) {
  const { data } = await apiClient.post<unknown>('/api/products', payload);
  return normalizeProduct(data);
}

export async function updateProduct(id: string, payload: Partial<ProductPayload>) {
  const { data } = await apiClient.patch<unknown>(`/api/products/${id}`, payload);
  return normalizeProduct(data);
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

export async function fetchCoupons(): Promise<Coupon[]> {
  const { data } = await apiClient.get<unknown>('/api/coupons');
  return normalizeCouponArray(data);
}

export async function createCoupon(payload: CreateCouponPayload): Promise<Coupon> {
  const { data } = await apiClient.post<unknown>('/api/coupons', payload);
  return normalizeCoupon(data);
}

export async function updateCoupon(
  id: string,
  payload: Partial<CreateCouponPayload>,
): Promise<Coupon> {
  const { data } = await apiClient.patch<unknown>(`/api/coupons/${id}`, payload);
  return normalizeCoupon(data);
}

export async function deleteCoupon(id: string): Promise<void> {
  await apiClient.delete(`/api/coupons/${id}`);
}

export async function fetchAdminCustomers(search?: string): Promise<CustomerOption[]> {
  const params = search ? { search } : undefined;
  const { data } = await apiClient.get<unknown>('/api/users/admin/customers', { params });
  return normalizeCustomerArray(data);
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

function normalizeProduct(payload: unknown): Product {
  if (payload && typeof payload === 'object') {
    const keys = ['product', 'data'];
    for (const key of keys) {
      const value = (payload as Record<string, unknown>)[key];
      if (value && typeof value === 'object' && 'name' in value) {
        return value as Product;
      }
    }
    if ('name' in payload) {
      return payload as Product;
    }
  }
  return {} as Product;
}

function normalizeCouponArray(payload: unknown): Coupon[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const root = payload as Record<string, unknown>;

  // Backend list shape: { status, data: { coupons: [...] } }
  if (root.data && typeof root.data === 'object') {
    const envelope = root.data as Record<string, unknown>;
    if (Array.isArray(envelope.coupons)) {
      return envelope.coupons as Coupon[];
    }
  }

  if (Array.isArray(root.coupons)) {
    return root.coupons as Coupon[];
  }

  return normalizeArray<Coupon>(payload, ['coupons']);
}

function normalizeCoupon(payload: unknown): Coupon {
  if (!payload || typeof payload !== 'object') {
    return {} as Coupon;
  }

  const root = payload as Record<string, unknown>;

  // Backend write shape: { status, data: { coupon: {...} } }
  if (root.data && typeof root.data === 'object') {
    const envelope = root.data as Record<string, unknown>;
    if (envelope.coupon && typeof envelope.coupon === 'object' && 'code' in envelope.coupon) {
      return envelope.coupon as Coupon;
    }
    if ('code' in envelope) {
      return envelope as unknown as Coupon;
    }
  }

  if (root.coupon && typeof root.coupon === 'object' && 'code' in root.coupon) {
    return root.coupon as Coupon;
  }

  if ('code' in root) {
    return root as unknown as Coupon;
  }

  return {} as Coupon;
}

function normalizeCustomerArray(payload: unknown): CustomerOption[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const root = payload as Record<string, unknown>;

  // Backend shape: { status, data: { customers: [...] } }
  if (root.data && typeof root.data === 'object') {
    const envelope = root.data as Record<string, unknown>;
    if (Array.isArray(envelope.customers)) {
      return envelope.customers as CustomerOption[];
    }
    if (Array.isArray(envelope.users)) {
      return envelope.users as CustomerOption[];
    }
  }

  if (Array.isArray(root.customers)) {
    return root.customers as CustomerOption[];
  }

  if (Array.isArray(root.users)) {
    return root.users as CustomerOption[];
  }

  return normalizeArray<CustomerOption>(payload, ['customers', 'users']);
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
