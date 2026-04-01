import { Star } from 'lucide-react';
import type { Product } from '../../types';

interface FeaturedToggleProps {
  product: Product;
  onToggle: (product: Product, nextValue: boolean) => void;
  disabled?: boolean;
}

export function FeaturedToggle({ product, onToggle, disabled = false }: FeaturedToggleProps) {
  const isFeatured = Boolean(product.isFeatured);

  return (
    <button
      type="button"
      onClick={() => onToggle(product, !isFeatured)}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
        isFeatured
          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      } disabled:cursor-not-allowed disabled:opacity-60`}
      title={isFeatured ? 'Remove featured status' : 'Mark as featured'}
    >
      <Star className="h-3.5 w-3.5" fill={isFeatured ? 'currentColor' : 'none'} />
      {isFeatured ? 'Featured' : 'Not featured'}
    </button>
  );
}
