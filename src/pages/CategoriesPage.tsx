import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Edit3, Plus, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
  uploadTempMedia,
} from '../api/endpoints';
import type { Category } from '../types';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

type ModalMode = {
  mode: 'create' | 'edit';
  category?: Category;
};

type UploadedImage = {
  key: string;
  originalName: string;
  url?: string;
};

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (!modal) {
      form.reset({ name: '', description: '' });
      setUploadedImage(null);
      return;
    }

    if (modal.mode === 'edit' && modal.category) {
      form.reset({
        name: modal.category.name ?? '',
        description: modal.category.description ?? '',
      });
      setUploadedImage(
        modal.category.image?.key
          ? {
              key: modal.category.image.key,
              originalName: modal.category.image.originalName ?? 'Category image',
            }
          : null,
      );
    } else {
      form.reset({ name: '', description: '' });
      setUploadedImage(null);
    }
  }, [form, modal]);

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      toast.success('Category created');
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      setModal(null);
    },
    onError: showApiError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateCategory>[1] }) =>
      updateCategory(id, payload),
    onSuccess: async () => {
      toast.success('Category updated');
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      setModal(null);
    },
    onError: showApiError,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: async () => {
      toast.success('Category deleted');
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: showApiError,
  });

  const isBusy = createMutation.isPending || updateMutation.isPending;

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  const handleOpenCreate = () => {
    setModal({ mode: 'create' });
  };

  const handleOpenEdit = (category: Category) => {
    setModal({ mode: 'edit', category });
  };

  const handleDelete = async (category: Category) => {
    const ok = window.confirm(`Delete category "${category.name}"?`);
    if (!ok) return;
    deleteMutation.mutate(category._id);
  };

  const handleImageSelect = async (file: File | null) => {
    if (!file) return;

    try {
      const uploaded = await uploadTempMedia(file);
      setUploadedImage({
        key: uploaded.key,
        originalName: uploaded.originalName ?? file.name,
        url: uploaded.url,
      });
      toast.success('Image uploaded');
    } catch (error) {
      showApiError(error);
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload = {
      name: values.name,
      description: values.description?.trim() || undefined,
      ...(uploadedImage
        ? {
            image: {
              key: uploadedImage.key,
              originalName: uploadedImage.originalName,
            },
          }
        : {}),
    };

    if (modal?.mode === 'create' && !uploadedImage) {
      toast.error('Please upload a category image before creating');
      return;
    }

    if (modal?.mode === 'edit' && modal.category) {
      updateMutation.mutate({
        id: modal.category._id,
        payload,
      });
      return;
    }

    createMutation.mutate(payload);
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Categories</h1>
          <p className="mt-2 text-slate-500">Create, edit, upload an image, and manage category records.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {categoriesQuery.isLoading ? (
          <div className="p-6 text-slate-500">Loading categories...</div>
        ) : categoriesQuery.isError ? (
          <div className="p-6 text-red-600">Failed to load categories.</div>
        ) : categories.length === 0 ? (
          <div className="p-6 text-slate-500">No categories found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Name</Th>
                  <Th>Description</Th>
                  <Th>Image</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {categories.map((category) => (
                  <tr key={category._id} className="hover:bg-slate-50/80">
                    <Td>
                      <div className="font-medium text-slate-900">{category.name}</div>
                    </Td>
                    <Td>
                      <div className="max-w-md truncate text-slate-600">{category.description || 'No description'}</div>
                    </Td>
                    <Td>
                      {category.image?.key ? (
                        <div className="flex items-center gap-3">
                          {category.image.url ? (
                            <img
                              src={category.image.url}
                              alt={category.image.originalName || category.name}
                              className="h-10 w-10 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                              <Upload className="h-4 w-4" />
                            </div>
                          )}
                          <span className="truncate text-sm text-slate-600">
                            {category.image.originalName || category.image.key}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">No image</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(category)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
                          disabled={deleteMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal ? (
        <Modal title={modal.mode === 'create' ? 'Add Category' : 'Edit Category'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Name" error={form.formState.errors.name?.message}>
              <input
                {...form.register('name')}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                placeholder="Category name"
              />
            </Field>

            <Field label="Description" error={form.formState.errors.description?.message}>
              <textarea
                {...form.register('description')}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                placeholder="Category description"
              />
            </Field>

            <Field label="Image">
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleImageSelect(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-500"
                />

                {uploadedImage ? (
                  <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {uploadedImage.url ? (
                        <img
                          src={uploadedImage.url}
                          alt={uploadedImage.originalName}
                          className="h-10 w-10 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700">
                          <Upload className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-slate-900">{uploadedImage.originalName}</div>
                        <div className="text-xs text-slate-500">Uploaded key: {uploadedImage.key}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadedImage(null)}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    No image selected
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
                {isBusy ? 'Saving...' : modal.mode === 'create' ? 'Create Category' : 'Update Category'}
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
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-blue-100/40">
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
  const message =
    error instanceof Error ? error.message : 'Something went wrong';
  toast.error(message);
}
