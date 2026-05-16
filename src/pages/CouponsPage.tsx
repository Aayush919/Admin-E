import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { showApiError } from '../lib/apiError';
import {
  createCoupon,
  deleteCoupon,
  fetchAdminCustomers,
  fetchCoupons,
  updateCoupon,
} from '../api/endpoints';
import type { Coupon, CreateCouponPayload, CustomerOption } from '../types';

const couponSchema = z
  .object({
    code: z.string().trim().min(1, 'Coupon code is required'),
    description: z.string().optional(),
    discountType: z.enum(['percentage', 'fixed']),
    discountValue: z.coerce.number().positive('Discount value must be > 0'),
    minPurchase: z.coerce.number().min(0, 'Min purchase cannot be negative').default(0),
    maxDiscount: z.union([z.coerce.number().positive(), z.literal('')]).optional(),
    usageLimit: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
    usageLimitPerUser: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
    isActive: z.boolean(),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
    restrictUsers: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === 'percentage' && data.discountValue > 100) {
      ctx.addIssue({
        code: 'custom',
        message: 'Percentage cannot exceed 100',
        path: ['discountValue'],
      });
    }
    if (data.validFrom && data.validUntil && new Date(data.validFrom) > new Date(data.validUntil)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Start date must be before end date',
        path: ['validUntil'],
      });
    }
  });

type CouponFormValues = z.infer<typeof couponSchema>;

type ModalMode = {
  mode: 'create' | 'edit';
  coupon?: Coupon;
};

export function CouponsPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');

  const couponsQuery = useQuery({
    queryKey: ['coupons'],
    queryFn: fetchCoupons,
  });

  const form = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: defaultFormValues(),
  });

  const discountType = form.watch('discountType');
  const restrictUsers = form.watch('restrictUsers');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  const customersQuery = useQuery({
    queryKey: ['admin-customers', debouncedCustomerSearch],
    queryFn: () => fetchAdminCustomers(debouncedCustomerSearch || undefined),
    enabled: Boolean(modal && restrictUsers),
  });

  useEffect(() => {
    if (!modal) {
      form.reset(defaultFormValues());
      setSelectedUserIds([]);
      setCustomerSearch('');
      setDebouncedCustomerSearch('');
      return;
    }

    if (modal.mode === 'edit' && modal.coupon) {
      const c = modal.coupon;
      form.reset({
        code: c.code,
        description: c.description ?? '',
        discountType: c.discountType,
        discountValue: c.discountValue,
        minPurchase: c.minPurchase ?? 0,
        maxDiscount: c.maxDiscount ?? '',
        usageLimit: c.usageLimit ?? '',
        usageLimitPerUser: c.usageLimitPerUser ?? '',
        isActive: c.isActive,
        validFrom: toDateInput(c.validFrom),
        validUntil: toDateInput(c.validUntil),
        restrictUsers: Boolean(c.allowedUsers?.length),
      });
      setSelectedUserIds(c.allowedUsers?.map((u) => u._id) ?? []);
    } else {
      form.reset(defaultFormValues());
      setSelectedUserIds([]);
    }
  }, [form, modal]);

  const createMutation = useMutation({
    mutationFn: createCoupon,
    onSuccess: async () => {
      toast.success('Coupon created');
      await queryClient.invalidateQueries({ queryKey: ['coupons'] });
      setModal(null);
    },
    onError: showApiError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCouponPayload> }) =>
      updateCoupon(id, payload),
    onSuccess: async () => {
      toast.success('Coupon updated');
      await queryClient.invalidateQueries({ queryKey: ['coupons'] });
      setModal(null);
    },
    onError: showApiError,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: async () => {
      toast.success('Coupon deleted');
      await queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: showApiError,
  });

  const isBusy = createMutation.isPending || updateMutation.isPending;
  const coupons = useMemo(() => {
    const raw = couponsQuery.data;
    return Array.isArray(raw) ? raw : [];
  }, [couponsQuery.data]);

  const customerOptions = useMemo(() => {
    const map = new Map<string, CustomerOption>();
    for (const c of customersQuery.data ?? []) {
      map.set(c._id, c);
    }
    if (modal?.mode === 'edit' && modal.coupon?.allowedUsers) {
      for (const u of modal.coupon.allowedUsers) {
        map.set(u._id, { _id: u._id, name: u.name, email: u.email });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.name || a.email).localeCompare(b.name || b.email),
    );
  }, [customersQuery.data, modal]);

  const handleOpenCreate = () => setModal({ mode: 'create' });
  const handleOpenEdit = (coupon: Coupon) => setModal({ mode: 'edit', coupon });

  const handleDelete = async (coupon: Coupon) => {
    const ok = window.confirm(`Delete coupon "${coupon.code}"?`);
    if (!ok) return;
    deleteMutation.mutate(coupon._id);
  };

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    if (values.restrictUsers && selectedUserIds.length === 0) {
      toast.error('Select at least one customer or choose "All customers"');
      return;
    }

    const payload: CreateCouponPayload = {
      code: values.code.trim(),
      description: values.description?.trim() || undefined,
      discountType: values.discountType,
      discountValue: values.discountValue,
      minPurchase: values.minPurchase ?? 0,
      isActive: values.isActive,
      allowedUsers: values.restrictUsers ? selectedUserIds : [],
    };

    if (values.discountType === 'percentage' && values.maxDiscount !== '' && values.maxDiscount != null) {
      payload.maxDiscount = Number(values.maxDiscount);
    }

    if (values.usageLimit !== '' && values.usageLimit != null) {
      payload.usageLimit = Number(values.usageLimit);
    }

    if (values.usageLimitPerUser !== '' && values.usageLimitPerUser != null) {
      payload.usageLimitPerUser = Number(values.usageLimitPerUser);
    }

    if (values.validFrom) {
      payload.validFrom = values.validFrom;
    }

    if (values.validUntil) {
      payload.validUntil = values.validUntil;
    }

    if (modal?.mode === 'edit' && modal.coupon) {
      updateMutation.mutate({ id: modal.coupon._id, payload });
      return;
    }

    createMutation.mutate(payload);
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Coupons</h1>
          <p className="mt-2 text-slate-500">
            Create and manage discount codes, usage limits, and customer eligibility.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Create coupon
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {couponsQuery.isLoading ? (
          <div className="p-6 text-black">Loading coupons...</div>
        ) : couponsQuery.isError ? (
          <div className="p-6 text-red-600">Failed to load coupons.</div>
        ) : coupons.length === 0 ? (
          <div className="p-6 text-black">No coupons yet. Create your first coupon.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-black">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Code</Th>
                  <Th>Discount</Th>
                  <Th>Min. cart</Th>
                  <Th>Usage</Th>
                  <Th>Per user</Th>
                  <Th>Eligible users</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-black">
                {coupons.map((coupon) => {
                  const expired = isExpired(coupon);
                  return (
                    <tr
                      key={coupon._id}
                      className={expired ? 'bg-slate-50/80 text-black' : 'text-black hover:bg-slate-50/80'}
                    >
                      <Td>
                        <span className="font-mono font-semibold text-black">{coupon.code}</span>
                      </Td>
                      <Td>{formatDiscount(coupon)}</Td>
                      <Td>{formatMinPurchase(coupon.minPurchase)}</Td>
                      <Td>{formatUsage(coupon)}</Td>
                      <Td>{formatPerUser(coupon.usageLimitPerUser)}</Td>
                      <Td>
                        <span className="max-w-xs truncate" title={formatEligibleUsers(coupon)}>
                          {formatEligibleUsers(coupon)}
                        </span>
                      </Td>
                      <Td>
                        <StatusBadge coupon={coupon} expired={expired} />
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(coupon)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-black transition hover:bg-slate-50"
                          >
                            <Edit3 className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(coupon)}
                            disabled={deleteMutation.isPending}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal ? (
        <Modal
          title={modal.mode === 'create' ? 'Create coupon' : 'Edit coupon'}
          onClose={() => setModal(null)}
        >
          <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Code *" error={form.formState.errors.code?.message}>
                <input
                  {...form.register('code')}
                  className={inputClass}
                  placeholder="SAVE10"
                />
              </Field>

              <Field label="Discount type *" error={form.formState.errors.discountType?.message}>
                <select {...form.register('discountType')} className={inputClass}>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </Field>

              <Field label="Discount value *" error={form.formState.errors.discountValue?.message}>
                <input
                  type="number"
                  step="any"
                  {...form.register('discountValue')}
                  className={inputClass}
                  placeholder={discountType === 'percentage' ? '10' : '200'}
                />
              </Field>

              <Field label="Min. purchase (₹)" error={form.formState.errors.minPurchase?.message}>
                <input type="number" min={0} {...form.register('minPurchase')} className={inputClass} />
              </Field>

              {discountType === 'percentage' ? (
                <Field label="Max discount (₹)" error={form.formState.errors.maxDiscount?.message}>
                  <input
                    type="number"
                    min={0}
                    {...form.register('maxDiscount')}
                    className={inputClass}
                    placeholder="Optional cap"
                  />
                </Field>
              ) : null}

              <Field label="Usage limit (total)" error={form.formState.errors.usageLimit?.message}>
                <input type="number" min={1} {...form.register('usageLimit')} className={inputClass} />
              </Field>

              <Field
                label="Usage limit per user"
                error={form.formState.errors.usageLimitPerUser?.message}
              >
                <input
                  type="number"
                  min={1}
                  {...form.register('usageLimitPerUser')}
                  className={inputClass}
                />
              </Field>

              <Field label="Valid from" error={form.formState.errors.validFrom?.message}>
                <input type="date" {...form.register('validFrom')} className={inputClass} />
              </Field>

              <Field label="Valid until" error={form.formState.errors.validUntil?.message}>
                <input type="date" {...form.register('validUntil')} className={inputClass} />
              </Field>
            </div>

            <Field label="Description" error={form.formState.errors.description?.message}>
              <textarea
                {...form.register('description')}
                rows={2}
                className={inputClass}
                placeholder="Internal note (optional)"
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" {...form.register('isActive')} className="rounded border-slate-300" />
              Active
            </label>

            <div className="rounded-xl border border-slate-200 p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  {...form.register('restrictUsers')}
                  className="rounded border-slate-300"
                />
                Selected customers only
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Leave unchecked for all customers. When restricted, only selected customers can use this
                code at checkout.
              </p>

              {restrictUsers ? (
                <div className="mt-4 space-y-3">
                  <input
                    type="search"
                    value={customerSearch}
                    onChange={(event) => setCustomerSearch(event.target.value)}
                    placeholder="Search by name or email..."
                    className={inputClass}
                  />

                  {selectedUserIds.length > 0 ? (
                    <p className="text-xs text-slate-500">
                      {selectedUserIds.length} customer{selectedUserIds.length === 1 ? '' : 's'}{' '}
                      selected
                    </p>
                  ) : null}

                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {customersQuery.isLoading ? (
                      <p className="text-sm text-slate-500">Loading customers...</p>
                    ) : customersQuery.isError ? (
                      <p className="text-sm text-red-600">Failed to load customers.</p>
                    ) : customerOptions.length === 0 ? (
                      <p className="text-sm text-amber-700">
                        {debouncedCustomerSearch
                          ? 'No customers match your search.'
                          : 'No customers found for this site.'}
                      </p>
                    ) : (
                      customerOptions.map((customer) => (
                        <label
                          key={customer._id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(customer._id)}
                            onChange={() => toggleUser(customer._id)}
                            className="rounded border-slate-300"
                          />
                          <span className="text-sm text-slate-800">
                            <span className="font-medium">{customer.name || 'Customer'}</span>
                            <span className="text-slate-500"> — {customer.email}</span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? 'Saving...' : modal.mode === 'create' ? 'Create coupon' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500';

function defaultFormValues(): CouponFormValues {
  return {
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    minPurchase: 0,
    maxDiscount: '',
    usageLimit: '',
    usageLimitPerUser: '',
    isActive: true,
    validFrom: '',
    validUntil: '',
    restrictUsers: false,
  };
}

function toDateInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function formatDiscount(c: Coupon): string {
  if (c.discountType === 'percentage') {
    const cap = c.maxDiscount != null ? ` (max ₹${c.maxDiscount})` : '';
    return `${c.discountValue}% off${cap}`;
  }
  return `₹${c.discountValue} off`;
}

function formatMinPurchase(minPurchase: number): string {
  if (!minPurchase) return 'No minimum';
  return `₹${minPurchase}`;
}

function formatUsage(c: Coupon): string {
  if (c.usageLimit != null) return `${c.usedCount} / ${c.usageLimit}`;
  return String(c.usedCount);
}

function formatPerUser(limit?: number): string {
  if (limit == null) return '—';
  return `${limit}× per user`;
}

function formatEligibleUsers(c: Coupon): string {
  if (!c.allowedUsers?.length) return 'All customers';
  return c.allowedUsers.map((u) => u.email).join(', ');
}

function isExpired(c: Coupon): boolean {
  return c.validUntil ? new Date(c.validUntil) < new Date() : false;
}

function StatusBadge({ coupon, expired }: { coupon: Coupon; expired: boolean }) {
  if (expired) {
    return (
      <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-black">
        Expired
      </span>
    );
  }
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        coupon.isActive
          ? 'bg-emerald-100 text-black'
          : 'bg-slate-200 text-black'
      }`}
    >
      {coupon.isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-black ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-6 py-4 align-top text-sm text-black">{children}</td>;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-500">{error}</span> : null}
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-blue-100/40">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
