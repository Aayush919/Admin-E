import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Edit3, Plus, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createProduct,
  deleteProduct,
  fetchCategories,
  fetchProducts,
  updateProduct,
  uploadTempMedia,
} from '../api/endpoints';
import type { Category, Product } from '../types';

const variantSchema = z.object({
  size: z.string().min(1, 'Size is required'),
  price: z.coerce.number().nonnegative('Variant price must be zero or greater'),
  stock: z.coerce.number().int().nonnegative('Variant stock must be zero or greater'),
});

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  basePrice: z.coerce.number().nonnegative('Base price must be zero or greater'),
  priceAfterDiscount: z.coerce.number().nonnegative().optional().or(z.literal('')),
  discountPercent: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  category: z.string().min(1, 'Category is required'),
  productType: z.enum(['clothes', 'book', 'other']),
  stock: z.coerce.number().int().nonnegative('Stock must be zero or greater'),
  variants: z.array(variantSchema),
});

type ProductFormValues = z.infer<typeof productSchema>;
type ModalMode = {
  mode: 'create' | 'edit';
  product?: Product;
};
type UploadedImage = {
  key: string;
  originalName: string;
  url?: string;
};

export function ProductsPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      basePrice: 0,
      priceAfterDiscount: '',
      discountPercent: '',
      category: '',
      productType: 'other',
      stock: 0,
      variants: [],
    },
  });

  const variants = useFieldArray({
    control: form.control,
    name: 'variants',
  });

  useEffect(() => {
    if (!modal) {
      form.reset({
        name: '',
        description: '',
        basePrice: 0,
        priceAfterDiscount: '',
        discountPercent: '',
        category: '',
        productType: 'other',
        stock: 0,
        variants: [],
      });
      variants.replace([]);
      setUploadedImages([]);
      return;
    }

    if (modal.mode === 'edit' && modal.product) {
      const categoryId =
        typeof modal.product.category === 'string' ? modal.product.category : modal.product.category?._id ?? '';

      form.reset({
        name: modal.product.name ?? '',
        description: modal.product.description ?? '',
        basePrice: modal.product.basePrice ?? 0,
        priceAfterDiscount: modal.product.priceAfterDiscount ?? '',
        discountPercent: modal.product.discountPercent ?? '',
        category: categoryId,
        productType: modal.product.productType ?? 'other',
        stock: modal.product.stock ?? 0,
        variants: modal.product.variants ?? [],
      });
      variants.replace(modal.product.variants ?? []);
      setUploadedImages(
        (modal.product.attachments ?? []).map((image) => ({
          key: image.key,
          originalName: image.originalName ?? image.key,
          url: image.url,
        })),
      );
    } else {
      form.reset({
        name: '',
        description: '',
        basePrice: 0,
        priceAfterDiscount: '',
        discountPercent: '',
        category: '',
        productType: 'other',
        stock: 0,
        variants: [],
      });
      variants.replace([]);
      setUploadedImages([]);
    }
  }, [form, modal, variants]);

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: async () => {
      toast.success('Product created');
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      setModal(null);
    },
    onError: showApiError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateProduct>[1] }) =>
      updateProduct(id, payload),
    onSuccess: async () => {
      toast.success('Product updated');
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      setModal(null);
    },
    onError: showApiError,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      toast.success('Product deleted');
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: showApiError,
  });

  const handleOpenCreate = () => {
    setModal({ mode: 'create' });
  };

  const handleOpenEdit = (product: Product) => {
    setModal({ mode: 'edit', product });
  };

  const handleDelete = async (product: Product) => {
    const ok = window.confirm(`Delete product "${product.name}"?`);
    if (!ok) return;
    deleteMutation.mutate(product._id);
  };

  const handleUploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      const uploads = await Promise.all(Array.from(files).map((file) => uploadTempMedia(file)));
      const mapped = uploads.map((uploaded, index) => ({
        key: uploaded.key,
        originalName: uploaded.originalName ?? files[index]?.name ?? uploaded.key,
        url: uploaded.url,
      }));
      setUploadedImages((current) => [...current, ...mapped]);
      toast.success('Image(s) uploaded');
    } catch (error) {
      showApiError(error);
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    if (modal?.mode === 'create' && uploadedImages.length === 0) {
      toast.error('Please upload at least one product image before creating');
      return;
    }

    const payload = {
      name: values.name,
      description: values.description?.trim() || undefined,
      basePrice: Number(values.basePrice),
      priceAfterDiscount:
        values.priceAfterDiscount === '' || values.priceAfterDiscount === undefined
          ? undefined
          : Number(values.priceAfterDiscount),
      discountPercent:
        values.discountPercent === '' || values.discountPercent === undefined
          ? undefined
          : Number(values.discountPercent),
      category: values.category,
      productType: values.productType,
      stock: Number(values.stock),
      variants: values.variants.length ? values.variants.map((variant) => ({
        size: variant.size,
        price: Number(variant.price),
        stock: Number(variant.stock),
      })) : undefined,
      ...(uploadedImages.length
        ? {
            attachments: uploadedImages.map((image) => ({
              key: image.key,
              originalName: image.originalName,
            })),
          }
        : {}),
    };

    if (modal?.mode === 'edit' && modal.product) {
      updateMutation.mutate({ id: modal.product._id, payload });
      return;
    }

    createMutation.mutate(payload);
  });

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Products</h1>
          <p className="mt-2 text-slate-500">Manage products, pricing, stock, variants, and product images.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Create Product
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {productsQuery.isLoading ? (
          <div className="p-6 text-slate-500">Loading products...</div>
        ) : productsQuery.isError ? (
          <div className="p-6 text-red-600">Failed to load products.</div>
        ) : products.length === 0 ? (
          <div className="p-6 text-slate-500">No products found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Image</Th>
                  <Th>Name</Th>
                  <Th>Category</Th>
                  <Th>Price</Th>
                  <Th>Stock</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {products.map((product) => {
                  const categoryName =
                    typeof product.category === 'string'
                      ? categories.find((category) => category._id === product.category)?.name ?? product.category
                      : product.category?.name ?? 'No category';
                  const image = product.attachments?.[0];

                  return (
                    <tr key={product._id} className="hover:bg-slate-50/80">
                      <Td>
                        {image ? (
                          image.url ? (
                            <img
                              src={image.url}
                              alt={image.originalName || product.name}
                              className="h-12 w-12 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                              <Upload className="h-4 w-4" />
                            </div>
                          )
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
                            -
                          </div>
                        )}
                      </Td>
                      <Td>
                        <div className="font-medium text-slate-900">{product.name}</div>
                        <div className="mt-1 max-w-xs truncate text-sm text-slate-500">
                          {product.description || 'No description'}
                        </div>
                      </Td>
                      <Td>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                          {categoryName}
                        </span>
                      </Td>
                      <Td>
                        <div className="text-slate-900">â‚¹{product.priceAfterDiscount ?? product.basePrice}</div>
                        {product.discountPercent ? (
                          <div className="text-xs text-slate-500">{product.discountPercent}% off</div>
                        ) : null}
                      </Td>
                      <Td>
                        <div className="text-slate-900">{product.stock}</div>
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <Edit3 className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
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
          title={modal.mode === 'create' ? 'Create Product' : 'Edit Product'}
          onClose={() => setModal(null)}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Name" error={form.formState.errors.name?.message}>
                <input
                  {...form.register('name')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                  placeholder="Product name"
                />
              </Field>

              <Field label="Category" error={form.formState.errors.category?.message}>
                <select
                  {...form.register('category')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Product Type" error={form.formState.errors.productType?.message}>
                <select
                  {...form.register('productType')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                >
                  <option value="clothes">Clothes</option>
                  <option value="book">Book</option>
                  <option value="other">Other</option>
                </select>
              </Field>

              <Field label="Stock" error={form.formState.errors.stock?.message}>
                <input
                  {...form.register('stock')}
                  type="number"
                  min={0}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                  placeholder="0"
                />
              </Field>

              <Field label="Base Price" error={form.formState.errors.basePrice?.message}>
                <input
                  {...form.register('basePrice')}
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                  placeholder="0.00"
                />
              </Field>

              <Field label="Price After Discount" error={form.formState.errors.priceAfterDiscount?.message}>
                <input
                  {...form.register('priceAfterDiscount')}
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                  placeholder="0.00"
                />
              </Field>

              <Field label="Discount %" error={form.formState.errors.discountPercent?.message}>
                <input
                  {...form.register('discountPercent')}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                  placeholder="0"
                />
              </Field>
            </div>

            <Field label="Description" error={form.formState.errors.description?.message}>
              <textarea
                {...form.register('description')}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                placeholder="Product description"
              />
            </Field>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Variants</h3>
                  <p className="text-xs text-slate-500">Optional size-based pricing and stock.</p>
                </div>
                <button
                  type="button"
                  onClick={() => variants.append({ size: '', price: 0, stock: 0 })}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
                >
                  Add Variant
                </button>
              </div>

              <div className="space-y-3">
                {variants.fields.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    No variants added.
                  </div>
                ) : (
                  variants.fields.map((field, index) => (
                    <div key={field.id} className="grid gap-3 md:grid-cols-4">
                      <input
                        {...form.register(`variants.${index}.size` as const)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                        placeholder="Size"
                      />
                      <input
                        {...form.register(`variants.${index}.price` as const)}
                        type="number"
                        min={0}
                        step="0.01"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                        placeholder="Price"
                      />
                      <input
                        {...form.register(`variants.${index}.stock` as const)}
                        type="number"
                        min={0}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                        placeholder="Stock"
                      />
                      <button
                        type="button"
                        onClick={() => variants.remove(index)}
                        className="rounded-xl border border-red-200 px-4 py-3 font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Field label="Images">
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => handleUploadImages(event.target.files)}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-500"
                />

                {uploadedImages.length > 0 ? (
                  <div className="space-y-2">
                    {uploadedImages.map((image) => (
                      <div
                        key={image.key}
                        className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          {image.url ? (
                            <img
                              src={image.url}
                              alt={image.originalName}
                              className="h-10 w-10 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700">
                              <Upload className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-slate-900">{image.originalName}</div>
                            <div className="text-xs text-slate-500">Uploaded key: {image.key}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setUploadedImages((current) => current.filter((item) => item.key !== image.key))
                          }
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-900"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    No images selected
                  </div>
                )}
              </div>
            </Field>

            <div className="flex items-center justify-end gap-3 pt-2">
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
                {isBusy ? 'Saving...' : modal.mode === 'create' ? 'Create Product' : 'Update Product'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-6 py-4 align-top text-sm">{children}</td>;
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
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-blue-100/40">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
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

function showApiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  toast.error(message);
}
