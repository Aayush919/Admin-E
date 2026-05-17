import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Copy,
  Edit3,
  ExternalLink,
  IndianRupee,
  MousePointerClick,
  Plus,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { showApiError } from '../../lib/apiError';
import {
  createAffiliate,
  deleteAffiliate,
  fetchAffiliateAnalytics,
  fetchAffiliateOrders,
  fetchAffiliates,
  markCommissionPaid,
  releasePendingCommissions,
  updateAffiliate,
} from '../../api/affiliateEndpoints';
import type { Affiliate, AffiliateOrderEarning, CreateAffiliatePayload } from '../../types/affiliate';
import {
  buildDashboardLink,
  buildStoreReferralLink,
  copyToClipboard,
  formatInr,
} from '../../utils/affiliateUtils';

const affiliateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Valid email required'),
  phone: z.string().optional(),
  referralCode: z
    .string()
    .trim()
    .min(3, 'Referral ID must be at least 3 characters')
    .max(32)
    .regex(/^[a-z0-9_-]+$/i, 'Use letters, numbers, underscore or hyphen only'),
  password: z.string().optional(),
  isActive: z.boolean(),
});

type AffiliateFormValues = z.infer<typeof affiliateSchema>;

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; affiliate: Affiliate }
  | { mode: 'orders'; affiliate: Affiliate };

export function AffiliatesPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalState | null>(null);

  const affiliatesQuery = useQuery({
    queryKey: ['affiliates'],
    queryFn: fetchAffiliates,
    refetchInterval: 30_000,
  });

  const analyticsQuery = useQuery({
    queryKey: ['affiliate-analytics'],
    queryFn: fetchAffiliateAnalytics,
    refetchInterval: 30_000,
  });

  const form = useForm<AffiliateFormValues>({
    resolver: zodResolver(affiliateSchema),
    defaultValues: defaultFormValues(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateAffiliatePayload) => createAffiliate(payload),
    onSuccess: () => {
      toast.success('Affiliate created');
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-analytics'] });
      setModal(null);
    },
    onError: showApiError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateAffiliatePayload }) =>
      updateAffiliate(id, payload),
    onSuccess: () => {
      toast.success('Affiliate updated');
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      setModal(null);
    },
    onError: showApiError,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAffiliate,
    onSuccess: () => {
      toast.success('Affiliate removed');
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-analytics'] });
    },
    onError: showApiError,
  });

  const releaseMutation = useMutation({
    mutationFn: releasePendingCommissions,
    onSuccess: (result) => {
      toast.success(`Released ${result.released} pending commission(s)`);
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-orders'] });
    },
    onError: showApiError,
  });

  const affiliates = affiliatesQuery.data ?? [];
  const analytics = analyticsQuery.data;

  const openCreate = () => {
    form.reset(defaultFormValues());
    setModal({ mode: 'create' });
  };

  const openEdit = (affiliate: Affiliate) => {
    form.reset({
      name: affiliate.name,
      email: affiliate.email,
      phone: affiliate.phone ?? '',
      referralCode: affiliate.referralCode,
      password: '',
      isActive: affiliate.isActive,
    });
    setModal({ mode: 'edit', affiliate });
  };

  const onSubmit = form.handleSubmit((values) => {
    const payload: CreateAffiliatePayload = {
      name: values.name,
      email: values.email,
      phone: values.phone || undefined,
      referralCode: values.referralCode.toLowerCase(),
      isActive: values.isActive,
      ...(values.password ? { password: values.password } : {}),
    };

    if (modal?.mode === 'edit') {
      updateMutation.mutate({ id: modal.affiliate._id, payload });
    } else {
      if (!values.password) {
        form.setError('password', { message: 'Password required for new affiliate' });
        return;
      }
      createMutation.mutate({ ...payload, password: values.password });
    }
  });

  const handleCopy = async (label: string, text: string) => {
    const ok = await copyToClipboard(text);
    toast[ok ? 'success' : 'error'](ok ? `${label} copied` : 'Copy failed');
  };

  const handleDelete = (affiliate: Affiliate) => {
    if (!window.confirm(`Remove affiliate "${affiliate.name}"?`)) return;
    deleteMutation.mutate(affiliate._id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Affiliates</h1>
          <p className="text-sm text-slate-600">
            Create partners, track referrals, and release commissions manually.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          New affiliate
        </button>
      </div>

      {analytics ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AnalyticsCard icon={Users} label="Active affiliates" value={`${analytics.activeAffiliates}/${analytics.totalAffiliates}`} />
          <AnalyticsCard icon={MousePointerClick} label="Total clicks" value={String(analytics.totalClicks)} />
          <AnalyticsCard icon={ShoppingBag} label="Referral orders" value={String(analytics.totalOrders)} />
          <AnalyticsCard icon={TrendingUp} label="Referral sales" value={formatInr(analytics.totalSales)} />
          <AnalyticsCard icon={IndianRupee} label="Commission owed" value={formatInr(analytics.totalCommission)} />
          <AnalyticsCard icon={Wallet} label="Paid out" value={formatInr(analytics.totalPaid)} />
          <AnalyticsCard icon={Wallet} label="Pending payout" value={formatInr(analytics.totalPending)} accent="amber" />
          <AnalyticsCard
            icon={TrendingUp}
            label="Conversion rate"
            value={`${(analytics.conversionRate * 100).toFixed(1)}%`}
          />
        </section>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {affiliatesQuery.isLoading ? (
          <p className="p-8 text-center text-slate-500">Loading affiliates…</p>
        ) : affiliates.length === 0 ? (
          <p className="p-8 text-center text-slate-500">No affiliates yet. Create your first partner.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Partner</th>
                  <th className="px-4 py-3 font-medium">Referral ID</th>
                  <th className="px-4 py-3 font-medium">Clicks</th>
                  <th className="px-4 py-3 font-medium">Orders</th>
                  <th className="px-4 py-3 font-medium">Sales</th>
                  <th className="px-4 py-3 font-medium">Pending</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {affiliates.map((row) => (
                  <tr key={row._id} className="text-slate-800">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.referralCode}</td>
                    <td className="px-4 py-3">{row.stats.totalClicks}</td>
                    <td className="px-4 py-3">{row.stats.totalOrders}</td>
                    <td className="px-4 py-3">{formatInr(row.stats.totalSales)}</td>
                    <td className="px-4 py-3 font-medium text-amber-800">
                      {formatInr(row.stats.pendingCommission)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <IconButton
                          title="Copy store link"
                          onClick={() => handleCopy('Store link', buildStoreReferralLink(row.referralCode))}
                        >
                          <Copy className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          title="Open dashboard"
                          onClick={() => window.open(buildDashboardLink(row.referralCode), '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </IconButton>
                        <IconButton title="View orders" onClick={() => setModal({ mode: 'orders', affiliate: row })}>
                          <ShoppingBag className="h-4 w-4" />
                        </IconButton>
                        <IconButton title="Edit" onClick={() => openEdit(row)}>
                          <Edit3 className="h-4 w-4" />
                        </IconButton>
                        <IconButton title="Delete" onClick={() => handleDelete(row)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal && (modal.mode === 'create' || modal.mode === 'edit') ? (
        <ModalShell onClose={() => setModal(null)} title={modal.mode === 'create' ? 'New affiliate' : 'Edit affiliate'}>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Name" error={form.formState.errors.name?.message}>
              <input {...form.register('name')} className={inputCls} />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <input type="email" {...form.register('email')} className={inputCls} />
            </Field>
            <Field label="Phone (optional)">
              <input {...form.register('phone')} className={inputCls} />
            </Field>
            <Field label="Referral ID / username" error={form.formState.errors.referralCode?.message}>
              <input
                {...form.register('referralCode')}
                className={inputCls}
                disabled={modal.mode === 'edit'}
                placeholder="e.g. priya_sharma"
              />
            </Field>
            <Field
              label={modal.mode === 'create' ? 'Dashboard password' : 'New password (optional)'}
              error={form.formState.errors.password?.message}
            >
              <input type="password" {...form.register('password')} className={inputCls} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" {...form.register('isActive')} className="rounded" />
              Active affiliate
            </label>
            {modal.mode === 'create' ? (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                After save, share the <strong>store link</strong> (?ref=code) with customers and the{' '}
                <strong>dashboard link</strong> (/affiliate/code) with the partner.
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className={secondaryBtnCls}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className={primaryBtnCls}
              >
                {modal.mode === 'create' ? 'Create affiliate' : 'Save changes'}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {modal?.mode === 'orders' ? (
        <OrdersModal
          affiliate={modal.affiliate}
          onClose={() => setModal(null)}
          onRelease={() => releaseMutation.mutate(modal.affiliate._id)}
          releasing={releaseMutation.isPending}
        />
      ) : null}
    </div>
  );
}

function OrdersModal({
  affiliate,
  onClose,
  onRelease,
  releasing,
}: {
  affiliate: Affiliate;
  onClose: () => void;
  onRelease: () => void;
  releasing: boolean;
}) {
  const queryClient = useQueryClient();
  const ordersQuery = useQuery({
    queryKey: ['affiliate-orders', affiliate._id],
    queryFn: () => fetchAffiliateOrders(affiliate._id),
    refetchInterval: 15_000,
  });

  const markPaidMutation = useMutation({
    mutationFn: (commissionId: string) => markCommissionPaid(commissionId),
    onSuccess: () => {
      toast.success('Marked as paid');
      queryClient.invalidateQueries({ queryKey: ['affiliate-orders', affiliate._id] });
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-analytics'] });
    },
    onError: showApiError,
  });

  const orders = ordersQuery.data ?? [];
  const storeLink = buildStoreReferralLink(affiliate.referralCode);
  const dashboardLink = buildDashboardLink(affiliate.referralCode);

  return (
    <ModalShell
      onClose={onClose}
      title={`Orders — ${affiliate.name}`}
      wide
      footer={
        <button
          type="button"
          disabled={releasing || affiliate.stats.pendingCommission <= 0}
          onClick={onRelease}
          className={primaryBtnCls}
        >
          {releasing ? 'Releasing…' : 'Approve & release all pending'}
        </button>
      }
    >
      <div className="mb-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        <p>
          <span className="font-medium text-slate-800">Store link:</span>{' '}
          <a href={storeLink} className="text-blue-600 underline" target="_blank" rel="noreferrer">
            {storeLink}
          </a>
        </p>
        <p>
          <span className="font-medium text-slate-800">Dashboard:</span>{' '}
          <a href={dashboardLink} className="text-blue-600 underline" target="_blank" rel="noreferrer">
            {dashboardLink}
          </a>
        </p>
      </div>

      {ordersQuery.isLoading ? (
        <p className="py-6 text-center text-slate-500">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="py-6 text-center text-slate-500">No referral orders yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Commission</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <OrderRow
                  key={order._id}
                  order={order}
                  onMarkPaid={() => markPaidMutation.mutate(order._id)}
                  marking={markPaidMutation.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  );
}

function OrderRow({
  order,
  onMarkPaid,
  marking,
}: {
  order: AffiliateOrderEarning;
  onMarkPaid: () => void;
  marking: boolean;
}) {
  const canPay = order.status === 'pending' || order.status === 'approved';
  return (
    <tr className="text-slate-800">
      <td className="px-3 py-2 font-mono text-xs">{order.orderNumber ?? order.orderId.slice(-8)}</td>
      <td className="px-3 py-2 text-xs">{order.customerEmail ?? '—'}</td>
      <td className="px-3 py-2">{formatInr(order.orderTotal)}</td>
      <td className="px-3 py-2 font-medium">{formatInr(order.commissionAmount)}</td>
      <td className="px-3 py-2 capitalize">{order.status}</td>
      <td className="px-3 py-2">
        {canPay ? (
          <button type="button" disabled={marking} onClick={onMarkPaid} className={secondaryBtnCls}>
            Mark paid
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function AnalyticsCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  accent?: 'amber';
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mb-2 inline-flex rounded-lg p-2 ${accent === 'amber' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ModalShell({
  children,
  title,
  onClose,
  wide,
  footer,
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  wide?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-xl ${wide ? 'max-w-4xl' : 'max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">{footer}</div> : null}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function defaultFormValues(): AffiliateFormValues {
  return {
    name: '',
    email: '',
    phone: '',
    referralCode: '',
    password: '',
    isActive: true,
  };
}

const inputCls =
  'w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500';
const primaryBtnCls =
  'rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60';
const secondaryBtnCls =
  'rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60';
