import { apiClient } from './apiClient';
import type {
  Affiliate,
  AffiliateAnalytics,
  AffiliateCommission,
  AffiliateDashboard,
  AffiliateOrderEarning,
  CreateAffiliatePayload,
  UpdateAffiliatePayload,
} from '../types/affiliate';

function unwrap<T>(payload: unknown, keys: string[]): T {
  if (!payload || typeof payload !== 'object') return payload as T;
  const root = payload as Record<string, unknown>;
  if (keys.some((k) => k in root)) {
    for (const key of keys) {
      const value = root[key];
      if (value !== undefined) return value as T;
    }
  }
  if (root.data && typeof root.data === 'object') {
    return unwrap<T>(root.data, keys);
  }
  return root as T;
}

export async function fetchAffiliates(): Promise<Affiliate[]> {
  const { data } = await apiClient.get<unknown>('/api/affiliates/admin/all');
  return unwrap<Affiliate[]>(data, ['affiliates']) ?? [];
}

export async function fetchAffiliateAnalytics(): Promise<AffiliateAnalytics> {
  const { data } = await apiClient.get<unknown>('/api/affiliates/admin/analytics');
  return unwrap<AffiliateAnalytics>(data, ['analytics']);
}

export async function createAffiliate(payload: CreateAffiliatePayload): Promise<Affiliate> {
  const { data } = await apiClient.post<unknown>('/api/affiliates/admin', payload);
  return unwrap<Affiliate>(data, ['affiliate']);
}

export async function updateAffiliate(id: string, payload: UpdateAffiliatePayload): Promise<Affiliate> {
  const { data } = await apiClient.patch<unknown>(`/api/affiliates/admin/${id}`, payload);
  return unwrap<Affiliate>(data, ['affiliate']);
}

export async function deleteAffiliate(id: string): Promise<void> {
  await apiClient.delete(`/api/affiliates/admin/${id}`);
}

export async function fetchAffiliateOrders(affiliateId: string): Promise<AffiliateOrderEarning[]> {
  const { data } = await apiClient.get<unknown>(`/api/affiliates/admin/${affiliateId}/orders`);
  return unwrap<AffiliateOrderEarning[]>(data, ['orders']) ?? [];
}

export async function markCommissionPaid(commissionId: string, note?: string): Promise<AffiliateCommission> {
  const { data } = await apiClient.post<unknown>(
    `/api/affiliates/admin/commissions/${commissionId}/mark-paid`,
    { note },
  );
  return unwrap<AffiliateCommission>(data, ['commission']);
}

export async function releasePendingCommissions(affiliateId: string): Promise<{ released: number }> {
  const { data } = await apiClient.post<unknown>(
    `/api/affiliates/admin/${affiliateId}/release-pending`,
  );
  return unwrap<{ released: number }>(data, ['result']) ?? { released: 0 };
}

/** Public — affiliate opens their dashboard link (optional access token from admin). */
export async function fetchAffiliateDashboard(
  referralCode: string,
  accessToken?: string,
): Promise<AffiliateDashboard> {
  const { data } = await apiClient.get<unknown>(
    `/api/affiliates/public/${encodeURIComponent(referralCode)}/dashboard`,
    { params: accessToken ? { token: accessToken } : undefined },
  );
  return unwrap<AffiliateDashboard>(data, ['dashboard']);
}

export async function verifyAffiliateDashboardAccess(
  referralCode: string,
  password: string,
): Promise<{ token: string }> {
  const { data } = await apiClient.post<unknown>(
    `/api/affiliates/public/${encodeURIComponent(referralCode)}/login`,
    { password },
  );
  const auth = unwrap<{ token: string }>(data, ['auth']);
  if (auth?.token) return auth;
  const token = unwrap<string>(data, ['token']);
  if (typeof token === 'string') return { token };
  throw new Error('Invalid login response');
}

/** Public — track click then storefront should set cookie (backend also sets Set-Cookie when same domain). */
export async function trackAffiliateClick(referralCode: string): Promise<void> {
  await apiClient.post('/api/affiliates/track-click', {
    referralCode,
    landingPath: window.location.pathname,
    referrer: document.referrer || undefined,
  });
}
