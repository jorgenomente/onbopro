'use client';

type LinkPickerProps = {
  label: string;
  url: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onRemove: () => void;
  onClose: () => void;
};

export function LinkPicker({
  label,
  url,
  onChange,
  onApply,
  onRemove,
  onClose,
}: LinkPickerProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-700">{label}</span>
        <button
          className="text-xs text-zinc-500 hover:text-zinc-700"
          type="button"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <input
          className="flex-1 rounded-full border border-zinc-200 px-3 py-2 text-xs text-zinc-700"
          value={url}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://"
        />
        <button
          className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700"
          type="button"
          onClick={onApply}
        >
          Aplicar
        </button>
        <button
          className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700"
          type="button"
          onClick={onRemove}
        >
          Quitar
        </button>
      </div>
    </div>
  );
}
