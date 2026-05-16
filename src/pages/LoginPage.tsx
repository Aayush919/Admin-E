import { forwardRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { InputHTMLAttributes } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { login } from '../api/endpoints';
import { getApiErrorMessage } from '../lib/apiError';
import { getDefaultSiteTag } from '../lib/storage';
import { useAuth } from '../providers/AuthProvider';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  siteTag: z.string().min(1, 'Site Tag is required'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', siteTag: getDefaultSiteTag() },
  });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      if (data.status !== 'success' || !data.token) {
        toast.error('Login failed');
        return;
      }
      auth.login({ token: data.token, siteTag: form.getValues('siteTag'), user: data.user });
      toast.success('Logged in successfully');
      navigate('/dashboard', { replace: true });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Login failed'));
    },
  });

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl shadow-blue-100/50"
      >
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Admin Login</h1>
          <p className="mt-2 text-sm text-slate-500">Use your tenant-specific credentials to continue.</p>
        </div>

        <div className="space-y-4">
          <Input label="Email" error={form.formState.errors.email?.message} {...form.register('email')} />
          <Input
            label="Password"
            type="password"
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
          <Input
            label="Site Tag"
            error={form.formState.errors.siteTag?.message}
            {...form.register('siteTag')}
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mutation.isPending ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }>(
  function Input({ label, error, ...props }, ref) {
    return (
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">{label}</span>
        <input
          ref={ref}
          {...props}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-blue-500"
        />
        {error ? <span className="mt-1 block text-xs text-red-400">{error}</span> : null}
      </label>
    );
  },
);

Input.displayName = 'Input';
