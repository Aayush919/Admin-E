const env = import.meta.env as ImportMetaEnv & Record<string, string | undefined>;

export const AFFILIATE_DELIVERY_DEDUCTION = 120;
export const AFFILIATE_COMMISSION_RATE = 0.2;
export const AFFILIATE_REF_COOKIE = 'aff_ref';
export const AFFILIATE_REF_SESSION_DAYS = 30;

export function getStorefrontUrl(): string {
  return env.VITE_STOREFRONT_URL ?? 'https://thakurjishringar.com';
}

export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return env.VITE_APP_URL ?? 'http://localhost:5173';
}

export function buildReferralLink(referralCode: string): string {
  const base = getStorefrontUrl().replace(/\/$/, '');
  return `${base}?ref=${encodeURIComponent(referralCode)}`;
}

export function buildDashboardLink(referralCode: string): string {
  const base = getAppBaseUrl().replace(/\/$/, '');
  return `${base}/affiliate/${encodeURIComponent(referralCode)}`;
}

/** Customer-facing store URL — storefront must read ?ref= and set aff_ref cookie */
export function buildStoreReferralLink(referralCode: string): string {
  return buildReferralLink(referralCode);
}

export function calculateAffiliateCommission(orderTotal: number) {
  const afterDelivery = Math.max(0, orderTotal - AFFILIATE_DELIVERY_DEDUCTION);
  const commission = Math.round(afterDelivery * AFFILIATE_COMMISSION_RATE * 100) / 100;
  return {
    orderTotal,
    deliveryDeduction: AFFILIATE_DELIVERY_DEDUCTION,
    commissionRate: AFFILIATE_COMMISSION_RATE,
    afterDelivery,
    commission,
  };
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
