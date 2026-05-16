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

export interface ProductPayload {
  name: string;
  description?: string;
  category: string;
  productType: 'clothes' | 'book' | 'other';
  size?: string;
  price?: number;
  priceAfterDiscount?: number;
  discountPercentage?: number;
  stock?: number;
  sizeVariants?: ProductVariant[];
  attachments: Array<{
    key: string;
    originalName: string;
  }>;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  siteTag?: string;
  price?: number;
  priceAfterDiscount?: number;
  discountPercentage?: number;
  basePrice?: number;
  discountPercent?: number;
  category: Category | string;
  productType: 'clothes' | 'book' | 'other';
  stock?: number;
  size?: string | number;
  variants?: ProductVariant[];
  sizeVariants?: ProductVariant[];
  selectedSizeVariant?: ProductVariant;
  attachments?: ProductImage[];
  isFeatured?: boolean;
  featuredAt?: string | null;
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

export type CouponDiscountType = 'percentage' | 'fixed';

export interface AllowedUser {
  _id: string;
  name: string;
  email: string;
}

export interface Coupon {
  _id: string;
  code: string;
  siteTag?: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minPurchase: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageLimitPerUser?: number;
  allowedUsers?: AllowedUser[];
  usedCount: number;
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCouponPayload {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageLimitPerUser?: number;
  allowedUsers?: string[];
  isActive?: boolean;
  validFrom?: string;
  validUntil?: string;
}

export interface CustomerOption {
  _id: string;
  name: string;
  email: string;
}
