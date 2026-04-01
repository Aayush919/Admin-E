import type { ReactNode } from 'react';
import { Edit3, Image as ImageIcon, Trash2 } from 'lucide-react';
import type { Product } from '../../types';
import { FeaturedToggle } from './FeaturedToggle';

interface ProductTableProps {
  products: Product[];
  selectedIds: string[];
  onToggleSelect: (productId: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onToggleFeatured: (product: Product, nextValue: boolean) => void;
  categoryNameFor: (product: Product) => string;
  busyProductId?: string | null;
}

export function ProductTable({
  products,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  onToggleFeatured,
  categoryNameFor,
  busyProductId = null,
}: ProductTableProps) {
  const allSelected = products.length > 0 && products.every((product) => selectedIds.includes(product._id));

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <Th className="w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => onToggleSelectAll(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  aria-label="Select all products"
                />
              </Th>
              <Th>Product</Th>
              <Th>Type</Th>
              <Th>Category</Th>
              <Th>Price</Th>
              <Th>Stock</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {products.map((product) => {
              const image = product.attachments?.[0];
              const price = formatPrice(product);
              const isBusy = busyProductId === product._id;

              return (
                <tr key={product._id} className="hover:bg-slate-50/80">
                  <Td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(product._id)}
                      onChange={() => onToggleSelect(product._id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Select ${product.name}`}
                    />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        {image?.url ? (
                          <img src={image.url} alt={image.originalName || product.name} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">{product.name}</div>
                        <div className="mt-1 max-w-xs truncate text-sm text-slate-500">
                          {product.description || 'No description'}
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className="inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-medium capitalize text-purple-700">
                      {product.productType}
                    </span>
                  </Td>
                  <Td>
                    <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      {categoryNameFor(product)}
                    </span>
                  </Td>
                  <Td>
                    <div className="text-slate-900">{price}</div>
                    {product.discountPercentage != null ? (
                      <div className="text-xs text-slate-500">{product.discountPercentage}% off</div>
                    ) : null}
                  </Td>
                  <Td>
                    <div className="text-slate-900">{formatStock(product)}</div>
                    {product.size ? <div className="text-xs text-slate-500">Size: {String(product.size)}</div> : null}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          product.isFeatured ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {product.isFeatured ? 'Featured' : 'Standard'}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap justify-end gap-2">
                      <FeaturedToggle product={product} onToggle={onToggleFeatured} disabled={isBusy} />
                      <button
                        type="button"
                        onClick={() => onEdit(product)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(product)}
                        disabled={isBusy}
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
    </div>
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

function formatPrice(product: Product) {
  const value = product.priceAfterDiscount ?? product.price ?? product.basePrice;
  if (typeof value !== 'number') {
    return 'N/A';
  }
  return `₹${value.toFixed(2)}`;
}

function formatStock(product: Product) {
  if (typeof product.stock === 'number') {
    return product.stock;
  }
  if (Array.isArray(product.sizeVariants) && product.sizeVariants.length > 0) {
    return product.sizeVariants.reduce((total, variant) => total + (variant.stock || 0), 0);
  }
  return 'N/A';
}
