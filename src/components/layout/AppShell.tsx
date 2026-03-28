import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { LayoutDashboard, Package, Settings, Shapes, ShoppingCart, LogOut } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/categories', label: 'Categories', icon: Shapes },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { logout, siteTag, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-full lg:flex">
      <aside className="border-r border-slate-200 bg-white px-4 py-6 lg:w-72">
        <div className="mb-8">
          <div className="text-lg font-semibold text-slate-900">Admin Panel</div>
          <div className="text-sm text-slate-500">E-commerce operations</div>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
                    isActive
                      ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col bg-transparent">
        <header className="flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-6 py-4 backdrop-blur">
          <div>
            <div className="text-sm text-slate-500">Signed in as</div>
            <div className="font-medium text-slate-900">{user?.name ?? user?.email ?? 'Admin'}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs text-blue-700">
              Site Tag: {siteTag ?? 'n/a'}
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
