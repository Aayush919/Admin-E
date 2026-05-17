import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Copy,
  IndianRupee,
  Loader2,
  MousePointerClick,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../lib/apiError';
import { fetchAffiliateDashboard, verifyAffiliateDashboardAccess } from '../../api/affiliateEndpoints';
import {
  AFFILIATE_COMMISSION_RATE,
  AFFILIATE_DELIVERY_DEDUCTION,
  buildDashboardLink,
  buildStoreReferralLink,
  copyToClipboard,
  formatInr,
} from '../../utils/affiliateUtils';

function accessKey(code: string) {
  return `affiliate_token_${code}`;
}

export function AffiliateDashboardPage() {
  const { code } = useParams();
  const referralCode = code ? decodeURIComponent(code) : '';
  const [password, setPassword] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    referralCode ? sessionStorage.getItem(accessKey(referralCode)) : null,
  );
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: ['affiliate-dashboard', referralCode, accessToken],
    queryFn: () => fetchAffiliateDashboard(referralCode, accessToken ?? undefined),
    enabled: Boolean(referralCode && accessToken),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!referralCode) return;
    if (!accessToken) {
      setNeedsPassword(true);
    }
  }, [referralCode, accessToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setLoginError('Enter your dashboard password');
      return;
    }
    setLoggingIn(true);
    setLoginError(null);
    try {
      const { token } = await verifyAffiliateDashboardAccess(referralCode, password);
      sessionStorage.setItem(accessKey(referralCode), token);
      setAccessToken(token);
      setNeedsPassword(false);
      setPassword('');
    } catch (err) {
      setLoginError(getApiErrorMessage(err, 'Invalid password'));
    } finally {
      setLoggingIn(false);
    }
  };

  const handleCopy = async (label: string, value: string) => {
    const ok = await copyToClipboard(value);
    toast[ok ? 'success' : 'error'](ok ? `${label} copied` : 'Copy failed');
  };

  if (!referralCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-700">
        Invalid dashboard link
      </div>
    );
  }

  if (needsPassword && !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg"
        >
          <h1 className="text-2xl font-semibold text-slate-900">Affiliate dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in with the password your admin shared for code{' '}
            <code className="rounded bg-slate-100 px-1.5 font-mono text-slate-900">{referralCode}</code>
          </p>
          <label className="mt-6 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
              placeholder="Dashboard password"
            />
          </label>
          {loginError ? <p className="mt-2 text-sm text-red-600">{loginError}</p> : null}
          <button
            type="submit"
            disabled={loggingIn}
            className="mt-6 w-full rounded-xl bg-blue-600 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {loggingIn ? 'Signing in…' : 'View dashboard'}
          </button>
        </form>
      </div>
    );
  }

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6">
        <p className="text-slate-700">
          {dashboardQuery.error instanceof Error
            ? dashboardQuery.error.message
            : 'Could not load dashboard'}
        </p>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem(accessKey(referralCode));
            setAccessToken(null);
            setNeedsPassword(true);
          }}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
        >
          Sign in again
        </button>
      </div>
    );
  }

  const { affiliate, stats, orders } = dashboardQuery.data;
  const storeLink = buildStoreReferralLink(affiliate.referralCode);
  const dashboardLink = buildDashboardLink(affiliate.referralCode);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">Affiliate partner</p>
            <h1 className="text-2xl font-semibold text-slate-900">{affiliate.name}</h1>
            <p className="text-sm text-slate-600">{affiliate.email}</p>
            <p className="mt-1 font-mono text-xs text-slate-500">ID: {affiliate.referralCode}</p>
          </div>
          <button
            type="button"
            onClick={() => dashboardQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${dashboardQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={MousePointerClick} label="Referral clicks" value={String(stats.totalClicks)} />
          <StatCard icon={ShoppingBag} label="Orders" value={String(stats.totalOrders)} />
          <StatCard icon={TrendingUp} label="Total sales" value={formatInr(stats.totalSales)} />
          <StatCard icon={IndianRupee} label="Commission earned" value={formatInr(stats.totalCommission)} />
          <StatCard icon={Wallet} label="Paid" value={formatInr(stats.paidCommission)} accent="green" />
          <StatCard icon={Wallet} label="Pending" value={formatInr(stats.pendingCommission)} accent="amber" />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Your links</h2>
          <p className="mt-1 text-sm text-slate-600">
            Share the referral link with customers. Commission: 20% after ₹{AFFILIATE_DELIVERY_DEDUCTION}{' '}
            delivery deduction per order.
          </p>
          <div className="mt-4 space-y-4">
            <LinkRow
              label="Store link (share with customers)"
              value={storeLink}
              onCopy={() => handleCopy('Store link', storeLink)}
            />
            <LinkRow
              label="Dashboard link (your stats)"
              value={dashboardLink}
              onCopy={() => handleCopy('Dashboard link', dashboardLink)}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-semibold text-slate-900">Order earnings</h2>
            <p className="text-sm text-slate-500">
              Commission = (order total − ₹{AFFILIATE_DELIVERY_DEDUCTION}) ×{' '}
              {AFFILIATE_COMMISSION_RATE * 100}%
            </p>
          </div>
          {orders.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No referred orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Order total</th>
                    <th className="px-4 py-3 font-medium">Commission</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((row) => (
                    <tr key={row._id} className="text-slate-800">
                      <td className="px-4 py-3 font-mono text-xs">
                        {row.orderNumber ?? row.orderId.slice(-8)}
                      </td>
                      <td className="px-4 py-3">
                        {new Date(row.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">{formatInr(row.orderTotal)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {formatInr(row.commissionAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-center text-xs text-slate-400">
          Stats refresh every 30 seconds · Last updated{' '}
          {new Date(dashboardQuery.data.updatedAt).toLocaleString()}
        </p>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  accent?: 'green' | 'amber';
}) {
  const accentCls =
    accent === 'green'
      ? 'text-emerald-700 bg-emerald-50'
      : accent === 'amber'
        ? 'text-amber-800 bg-amber-50'
        : 'text-blue-700 bg-blue-50';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 inline-flex rounded-xl p-2 ${accentCls}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function LinkRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs text-slate-800 ring-1 ring-slate-200">
          {value}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Copy className="h-4 w-4" />
          Copy
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'paid'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'pending'
        ? 'bg-amber-100 text-amber-900'
        : status === 'rejected'
          ? 'bg-red-100 text-red-800'
          : 'bg-slate-100 text-slate-700';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}
