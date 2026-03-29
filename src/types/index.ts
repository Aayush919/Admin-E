export type ApiStatus = 'success' | 'error';

export interface User {
  _id?: string;
  name?: string;
  email: string;
  role?: string;
  [key: string]: unknown;
}

export interface LoginResponse {
  status: 'success';
  token: string;
  user: User;
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  image?: {
    key: string;
    originalName?: string;
    url?: string;
  } | null;
}

export interface ProductVariant {
  size: string | number;
  price: number;
  priceAfterDiscount?: number;
  discountPercentage?: number;
  stock: number;
}

export interface ProductImage {
  key: string;
  originalName?: string;
  url?: string;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  basePrice?: number;
  priceAfterDiscount?: number;
  discountPercent?: number;
  category: Category | string;
  productType: 'clothes' | 'book' | 'other';
  stock: number;
  variants?: ProductVariant[];
  sizeVariants?: ProductVariant[];
  selectedSizeVariant?: ProductVariant;
  attachments?: ProductImage[];
}

export interface Order {
  _id: string;
  status: string;
  totalAmount: number;
  createdAt?: string;
  cancelRequest?: boolean;
}

export interface ApiErrorResponse {
  status: 'error';
  message: string;
}
