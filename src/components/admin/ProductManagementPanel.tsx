import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Filter, Plus, Search, Star } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCategories } from '../../api/endpoints';
import { useAuth } from '../../providers/AuthProvider';
import type { Category, Product, ProductPayload } from '../../types';
import {
  createProduct,
  deleteProduct,
  getFeaturedProducts,
  getProducts,
  updateFeaturedProducts,
  updateProduct,
} from '../../utils/productApi';
import { BulkActionsBar } from './BulkActionsBar';
import { ProductForm } from './ProductForm';
import { ProductTable } from './ProductTable';

type ViewScope = 'all' | 'featured';

interface ProductManagementPanelProps {
  scope: ViewScope;
}

type ProductFilterState = {
  search: string;
  category: string;
  productType: 'all' | Product['productType'];
  featured: 'all' | 'featured' | 'unfeatured';
};

const PAGE_SIZE = 10;

export function ProductManagementPanel({ scope }: ProductManagementPanelProps) {
  const queryClient = useQueryClient();
  const { siteTag, token } = useAuth();
  const [formState, setFormState] = useState<{ open: boolean; mode: 'create' | 'edit'; product?: Product | null }>({
    open: false,
    mode: 'create',
    product: null,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ProductFilterState>({
    search: '',
    category: 'all',
    productType: 'all',
    featured: scope === 'featured' ? 'featured' : 'all',
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const productsQuery = useQuery({
    queryKey: ['products', scope],
    queryFn: async () => {
      if (!siteTag) {
        throw new Error('Missing site tag');
      }

      if (scope === 'featured') {
        if (!token) {
          throw new Error('Missing admin token');
        }
        return getFeaturedProducts(siteTag, token);
      }

      return getProducts(siteTag, { limit: 1000 });
    },
    enabled: Boolean(siteTag),
  });

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.category, filters.productType, filters.featured, scope]);

  useEffect(() => {
    setSelectedIds([]);
  }, [filters.search, filters.category, filters.productType, filters.featured, scope]);

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const products = useMemo(() => productsQuery.data?.products ?? [], [productsQuery.data]);

  const categoryLookup = useMemo(() => {
    return new Map(categories.map((category) => [category._id, category]));
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return products.filter((product) => {
      if (scope === 'featured' && !product.isFeatured) {
        return false;
      }

      if (filters.category !== 'all') {
        const categoryId = typeof product.category === 'string' ? product.category : product.category?._id;
        if (categoryId !== filters.category) {
          return false;
        }
      }

      if (filters.productType !== 'all' && product.productType !== filters.productType) {
        return false;
      }

      if (filters.featured === 'featured' && !product.isFeatured) {
        return false;
      }

      if (filters.featured === 'unfeatured' && product.isFeatured) {
        return false;
      }

      if (search) {
        const categoryName =
          typeof product.category === 'string'
            ? categoryLookup.get(product.category)?.name ?? product.category
            : product.category?.name ?? '';
        const haystack = [
          product.name,
          product.description ?? '',
          product.productType,
          categoryName,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }, [categoryLookup, filters.category, filters.featured, filters.productType, filters.search, products, scope]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const featureMutation = useMutation({
    mutationFn: async ({ productIds, isFeatured }: { productIds: string | string[]; isFeatured: boolean }) => {
      if (!siteTag || !token) {
        throw new Error('Missing admin credentials');
      }
      return updateFeaturedProducts(productIds, isFeatured, siteTag, token);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['products', scope] });
      toast.success('Featured status updated');
      if (Array.isArray(variables.productIds)) {
        setSelectedIds([]);
      }
    },
    onError: showApiError,
    onSettled: () => setBusyProductId(null),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: ProductPayload) => {
      if (!siteTag || !token) {
        throw new Error('Missing admin credentials');
      }
      return createProduct(payload, siteTag, token);
    },
    onSuccess: async () => {
      toast.success('Product created');
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['products', scope] });
      setFormState({ open: false, mode: 'create', product: null });
    },
    onError: showApiError,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ productId, payload }: { productId: string; payload: ProductPayload }) => {
      if (!siteTag || !token) {
        throw new Error('Missing admin credentials');
      }
      return updateProduct(productId, payload, siteTag, token);
    },
    onSuccess: async () => {
      toast.success('Product updated');
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['products', scope] });
      setFormState({ open: false, mode: 'create', product: null });
    },
    onError: showApiError,
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!siteTag || !token) {
        throw new Error('Missing admin credentials');
      }
      setBusyProductId(productId);
      return deleteProduct(productId, siteTag, token);
    },
    onSuccess: async (_data, productId) => {
      toast.success('Product deleted');
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['products', scope] });
      setSelectedIds((current) => current.filter((id) => id !== productId));
    },
    onError: showApiError,
    onSettled: () => setBusyProductId(null),
  });

  const isLoading = productsQuery.isLoading || categoriesQuery.isLoading;
  const isError = productsQuery.isError || categoriesQuery.isError;
  const summaryFeaturedCount = products.filter((product) => product.isFeatured).length;

  const handleToggleFeatured = (product: Product, nextValue: boolean) => {
    setBusyProductId(product._id);
    featureMutation.mutate({ productIds: product._id, isFeatured: nextValue });
  };

  const handleBulkFeaturedChange = (isFeatured: boolean) => {
    if (selectedIds.length === 0) return;
    setBusyProductId('bulk');
    featureMutation.mutate({ productIds: selectedIds.length === 1 ? selectedIds[0] : selectedIds, isFeatured });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const ok = window.confirm(`Delete ${selectedIds.length} selected product(s)?`);
    if (!ok) return;

    if (!siteTag || !token) {
      toast.error('Missing admin credentials');
      return;
    }

    await Promise.all(selectedIds.map((id) => deleteProduct(id, siteTag, token)));
    await queryClient.invalidateQueries({ queryKey: ['products'] });
    await queryClient.invalidateQueries({ queryKey: ['products', scope] });
    toast.success('Selected products deleted');
    setSelectedIds([]);
  };

  const handleDeleteProduct = async (product: Product) => {
    const ok = window.confirm(`Delete product "${product.name}"?`);
    if (!ok) return;
    await deleteMutation.mutateAsync(product._id);
  };

  const handleSubmitForm = async (payload: ProductPayload) => {
    if (formState.mode === 'edit' && formState.product) {
      await updateMutation.mutateAsync({ productId: formState.product._id, payload });
      return;
    }

    await createMutation.mutateAsync(payload);
  };

  const handleToggleSelectAll = (checked: boolean) => {
    const pageIds = paginatedProducts.map((product) => product._id);
    setSelectedIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...pageIds]));
      }

      return current.filter((id) => !pageIds.includes(id));
    });
  };

  const handleToggleSelect = (productId: string) => {
    setSelectedIds((current) =>
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId],
    );
  };

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              <Star className="h-3.5 w-3.5" />
              {scope === 'featured' ? 'Featured products' : 'Product catalog'}
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">
                {scope === 'featured' ? 'Featured Products' : 'Products'}
              </h1>
              <p className="mt-2 max-w-2xl text-slate-500">
                {scope === 'featured'
                  ? 'Review and manage products currently marked as featured.'
                  : 'Create, edit, delete, filter, and feature products from the admin panel.'}
              </p>
            </div>
          </div>
          {scope === 'all' ? (
            <button
              type="button"
              onClick={() => setFormState({ open: true, mode: 'create', product: null })}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500"
            >
              <Plus className="h-4 w-4" />
              Create Product
            </button>
          ) : null}
        </div>

        {scope === 'all' ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <SummaryCard label="Total products" value={filteredProducts.length} />
            <SummaryCard label="Featured" value={summaryFeaturedCount} />
            <SummaryCard label="In current page" value={paginatedProducts.length} />
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                placeholder="Search products"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Category</span>
            <select
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Type</span>
            <select
              value={filters.productType}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  productType: event.target.value as ProductFilterState['productType'],
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
            >
              <option value="all">All types</option>
              <option value="clothes">Clothes</option>
              <option value="book">Book</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Featured</span>
            <select
              value={filters.featured}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  featured: event.target.value as ProductFilterState['featured'],
                }))
              }
              disabled={scope === 'featured'}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition disabled:bg-slate-50 disabled:text-slate-400 focus:border-blue-500"
            >
              <option value="all">All products</option>
              <option value="featured">Featured only</option>
              <option value="unfeatured">Not featured</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
            <Filter className="h-3.5 w-3.5" />
            Showing {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'}
          </div>
          <div className="text-xs text-slate-500">
            Every request includes `X-Site-Tag` and admin actions require the bearer token.
          </div>
        </div>
      </div>

      <BulkActionsBar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        onFeatureSelected={() => handleBulkFeaturedChange(true)}
        onUnfeatureSelected={() => handleBulkFeaturedChange(false)}
        onDeleteSelected={scope === 'all' ? handleDeleteSelected : undefined}
        busy={featureMutation.isPending || deleteMutation.isPending || createMutation.isPending || updateMutation.isPending}
      />

      {isLoading ? (
        <StateCard title="Loading products" description="Fetching the latest product records from the API." />
      ) : isError ? (
        <StateCard
          title="Unable to load products"
          description="We could not fetch products right now. Please check the API connection and try again."
        />
      ) : paginatedProducts.length === 0 ? (
        <StateCard
          title="No products found"
          description={scope === 'featured'
            ? 'No products are currently marked as featured.'
            : 'Try adjusting the filters or create the first product.'}
        />
      ) : (
        <ProductTable
          products={paginatedProducts}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onEdit={(product) => setFormState({ open: true, mode: 'edit', product })}
          onDelete={handleDeleteProduct}
          onToggleFeatured={handleToggleFeatured}
          categoryNameFor={(product) => {
            if (typeof product.category === 'string') {
              return categoryLookup.get(product.category)?.name ?? product.category;
            }
            return product.category?.name ?? 'Uncategorized';
          }}
          busyProductId={busyProductId}
        />
      )}

      {filteredProducts.length > PAGE_SIZE ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:flex-row">
          <div className="text-sm text-slate-600">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage === totalPages}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <ProductForm
        open={formState.open}
        mode={formState.mode}
        product={formState.product}
        categories={categories}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => setFormState({ open: false, mode: 'create', product: null })}
        onSubmit={handleSubmitForm}
      />
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function StateCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{description}</p>
    </div>
  );
}

function showApiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  toast.error(message);
}
