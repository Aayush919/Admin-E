import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { uploadTempMedia } from '../../api/endpoints';
import type { Category, Product, ProductPayload } from '../../types';

const sizeVariantSchema = z.object({
  size: z.union([z.string(), z.number()]),
  price: z.coerce.number().min(0),
  priceAfterDiscount: z.coerce.number().min(0).optional(),
  discountPercentage: z.coerce.number().min(0).max(100).optional(),
  stock: z.coerce.number().int().min(0),
});

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  productType: z.enum(['clothes', 'book', 'other']),
  category: z.string().min(1, 'Category is required'),
  size: z.string().optional(),
  price: z.coerce.number().min(0).optional(),
  priceAfterDiscount: z.coerce.number().min(0).optional(),
  discountPercentage: z.coerce.number().min(0).max(100).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  sizeVariants: z.array(sizeVariantSchema).optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

type DraftAttachment = {
  key: string;
  originalName: string;
  url?: string;
};

interface ProductFormProps {
  open: boolean;
  mode: 'create' | 'edit';
  categories: Category[];
  product?: Product | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: ProductPayload) => Promise<void> | void;
}

export function ProductForm({
  open,
  mode,
  categories,
  product,
  isSubmitting = false,
  onClose,
  onSubmit,
}: ProductFormProps) {
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
      productType: 'other',
      category: '',
      size: '',
      price: undefined,
      priceAfterDiscount: undefined,
      discountPercentage: undefined,
      stock: undefined,
      sizeVariants: [],
    },
  });

  const sizeVariants = useFieldArray({
    control: form.control,
    name: 'sizeVariants',
  });
  const resetForm = form.reset;
  const replaceSizeVariants = sizeVariants.replace;

  const watchedType = form.watch('productType');

  useEffect(() => {
    if (!open) {
      resetForm({
        name: '',
        description: '',
        productType: 'other',
        category: '',
        size: '',
        price: undefined,
        priceAfterDiscount: undefined,
        discountPercentage: undefined,
        stock: undefined,
        sizeVariants: [],
      });
      replaceSizeVariants([]);
      setAttachments([]);
      return;
    }

    if (mode === 'edit' && product) {
      const mappedVariants = (product.sizeVariants ?? product.variants ?? []).map((variant) => ({
        size: variant.size,
        price: variant.price,
        priceAfterDiscount: variant.priceAfterDiscount,
        discountPercentage: variant.discountPercentage,
        stock: variant.stock,
      }));

      resetForm({
        name: product.name ?? '',
        description: product.description ?? '',
        productType: product.productType ?? 'other',
        category: typeof product.category === 'string' ? product.category : product.category?._id ?? '',
        size: product.size != null ? String(product.size) : '',
        price: product.price ?? product.basePrice,
        priceAfterDiscount: product.priceAfterDiscount,
        discountPercentage: product.discountPercentage ?? product.discountPercent,
        stock: product.stock,
        sizeVariants: mappedVariants,
      });
      replaceSizeVariants(mappedVariants);
      setAttachments(
        (product.attachments ?? []).map((attachment) => ({
          key: attachment.key,
          originalName: attachment.originalName ?? attachment.key,
          url: attachment.url,
        })),
      );
      return;
    }

    resetForm({
      name: '',
      description: '',
      productType: 'other',
      category: '',
      size: '',
      price: undefined,
      priceAfterDiscount: undefined,
      discountPercentage: undefined,
      stock: undefined,
      sizeVariants: [],
    });
    replaceSizeVariants([]);
    setAttachments([]);
  }, [mode, open, product?._id, replaceSizeVariants, resetForm]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      const uploads = await Promise.all(Array.from(files).map((file) => uploadTempMedia(file)));
      const mapped = uploads.map((uploaded: any, index) => ({
        key: uploaded?.data?.file?.key ?? uploaded?.key ?? `${Date.now()}-${index}`,
        originalName: uploaded?.data?.file?.originalName ?? files[index]?.name ?? 'Upload',
        url: uploaded?.data?.file?.url,
      }));

      setAttachments((current) => [...current, ...mapped]);
      toast.success('Attachment uploaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload attachment');
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    if (attachments.length === 0) {
      toast.error('Please add at least one product image');
      return;
    }

    if (values.productType === 'clothes' && (!values.sizeVariants || values.sizeVariants.length === 0)) {
      toast.error('Please add at least one size variant for clothes');
      return;
    }

    if (values.productType !== 'clothes' && values.price == null) {
      toast.error('Please set a price for this product');
      return;
    }

    const payload: ProductPayload = {
      name: values.name.trim(),
      category: values.category,
      productType: values.productType,
      attachments: attachments.map((attachment) => ({
        key: attachment.key,
        originalName: attachment.originalName,
      })),
    };

    if (values.description?.trim()) {
      payload.description = values.description.trim();
    }

    if (values.size?.trim()) {
      payload.size = values.size.trim();
    }

    if (values.productType === 'clothes') {
      payload.sizeVariants = values.sizeVariants ?? [];
    } else {
      if (values.price != null) payload.price = values.price;
      if (values.priceAfterDiscount != null) {
        payload.priceAfterDiscount = values.priceAfterDiscount;
      }
      if (values.discountPercentage != null) {
        payload.discountPercentage = values.discountPercentage;
      }
      if (values.stock != null) payload.stock = values.stock;
    }

    await onSubmit(payload);
  });

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-blue-100/40">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {mode === 'create' ? 'Create Product' : 'Edit Product'}
            </h2>
            <p className="text-sm text-slate-500">Manage product details, images, and featured state from one place.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Product Name" error={form.formState.errors.name?.message}>
              <input
                {...form.register('name')}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                placeholder="Cotton T-Shirt"
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

            <Field label="Size" error={form.formState.errors.size?.message}>
              <input
                {...form.register('size')}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                placeholder="S, M, L, 42, etc."
              />
            </Field>
          </div>

          <Field label="Description" error={form.formState.errors.description?.message}>
            <textarea
              {...form.register('description')}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
              placeholder="Product description"
            />
          </Field>

          {watchedType === 'clothes' ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Size Variants</h3>
                  <p className="text-xs text-slate-500">Add one or more size-specific price and stock entries.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    sizeVariants.append({
                      size: '',
                      price: 0,
                      stock: 0,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
                >
                  <Plus className="h-4 w-4" />
                  Add Variant
                </button>
              </div>

              <div className="space-y-3">
                {sizeVariants.fields.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    No size variants added.
                  </div>
                ) : (
                  sizeVariants.fields.map((field, index) => (
                    <div key={field.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="grid gap-3 md:grid-cols-6">
                        <Field label="Size" error={form.formState.errors.sizeVariants?.[index]?.size?.message}>
                          <input
                            {...form.register(`sizeVariants.${index}.size` as const)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                            placeholder="XS, S, M, L"
                          />
                        </Field>
                        <Field label="Price" error={form.formState.errors.sizeVariants?.[index]?.price?.message}>
                          <input
                            {...form.register(`sizeVariants.${index}.price` as const)}
                            type="number"
                            min={0}
                            step="0.01"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                            placeholder="0"
                          />
                        </Field>
                        <Field
                          label="After Discount"
                          error={form.formState.errors.sizeVariants?.[index]?.priceAfterDiscount?.message}
                        >
                          <input
                            {...form.register(`sizeVariants.${index}.priceAfterDiscount` as const)}
                            type="number"
                            min={0}
                            step="0.01"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                            placeholder="0"
                          />
                        </Field>
                        <Field
                          label="Discount %"
                          error={form.formState.errors.sizeVariants?.[index]?.discountPercentage?.message}
                        >
                          <input
                            {...form.register(`sizeVariants.${index}.discountPercentage` as const)}
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                            placeholder="0"
                          />
                        </Field>
                        <Field label="Stock" error={form.formState.errors.sizeVariants?.[index]?.stock?.message}>
                          <input
                            {...form.register(`sizeVariants.${index}.stock` as const)}
                            type="number"
                            min={0}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                            placeholder="0"
                          />
                        </Field>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => sizeVariants.remove(index)}
                            className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Price" error={form.formState.errors.price?.message}>
                <input
                  {...form.register('price')}
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

              <Field label="Discount %" error={form.formState.errors.discountPercentage?.message}>
                <input
                  {...form.register('discountPercentage')}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                  placeholder="0"
                />
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
            </div>
          )}

          <Field label="Product Images">
            <div className="space-y-3">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => handleUpload(event.target.files)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-500"
              />

              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.key}
                      className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        {attachment.url ? (
                          <img
                            src={attachment.url}
                            alt={attachment.originalName}
                            className="h-10 w-10 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700">
                            <Upload className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-slate-900">{attachment.originalName}</div>
                          <div className="text-xs text-slate-500">Key: {attachment.key}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttachments((current) => current.filter((item) => item.key !== attachment.key))}
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
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Product' : 'Update Product'}
            </button>
          </div>
        </form>
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
