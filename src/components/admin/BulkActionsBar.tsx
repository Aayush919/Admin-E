import { Star, StarOff, Trash2, X } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  onFeatureSelected: () => void;
  onUnfeatureSelected: () => void;
  onDeleteSelected?: () => void;
  busy?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onClear,
  onFeatureSelected,
  onUnfeatureSelected,
  onDeleteSelected,
  busy = false,
}: BulkActionsBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="text-sm font-medium text-blue-900">
        {selectedCount} product{selectedCount === 1 ? '' : 's'} selected
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onFeatureSelected}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Star className="h-4 w-4" />
          Feature
        </button>
        <button
          type="button"
          onClick={onUnfeatureSelected}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <StarOff className="h-4 w-4" />
          Unfeature
        </button>
        {onDeleteSelected ? (
          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
      </div>
    </div>
  );
}
