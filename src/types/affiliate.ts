export interface AffiliateStats {
  totalClicks: number;
  totalOrders: number;
  totalSales: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
}

export interface Affiliate {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  referralCode: string;
  isActive: boolean;
  dashboardAccessToken?: string;
  stats: AffiliateStats;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAffiliatePayload {
  name: string;
  email: string;
  phone?: string;
  referralCode: string;
  password?: string;
  isActive?: boolean;
}

export interface UpdateAffiliatePayload {
  name?: string;
  email?: string;
  phone?: string;
  referralCode?: string;
  password?: string;
  isActive?: boolean;
}

export interface AffiliateOrderEarning {
  _id: string;
  orderId: string;
  orderNumber?: string;
  customerEmail?: string;
  orderTotal: number;
  deliveryDeduction: number;
  commissionableAmount: number;
  commissionAmount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  createdAt: string;
  paidAt?: string;
}

export interface AffiliateCommission {
  _id: string;
  affiliateId: string;
  amount: number;
  status: 'pending' | 'paid';
  paidAt?: string;
  note?: string;
}

export interface AffiliateDashboard {
  affiliate: Pick<Affiliate, '_id' | 'name' | 'email' | 'referralCode' | 'isActive'>;
  stats: AffiliateStats;
  referralLink: string;
  dashboardLink: string;
  orders: AffiliateOrderEarning[];
  updatedAt: string;
}

export interface AffiliateAnalytics {
  totalAffiliates: number;
  activeAffiliates: number;
  totalClicks: number;
  totalOrders: number;
  totalSales: number;
  totalCommission: number;
  totalPaid: number;
  totalPending: number;
  conversionRate: number;
}
