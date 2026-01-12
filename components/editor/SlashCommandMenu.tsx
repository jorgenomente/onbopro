'use client';

export type SlashCommandItem = {
  title: string;
  description: string;
};

type SlashCommandMenuProps = {
  items: SlashCommandItem[];
  selectedIndex: number;
};

export function SlashCommandMenu({
  items,
  selectedIndex,
}: SlashCommandMenuProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-500 shadow-sm">
        Sin resultados.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
      {items.map((item, index) => (
        <div
          key={`${item.title}-${item.description}`}
          className={`rounded-lg px-3 py-2 text-xs ${
            index === selectedIndex
              ? 'bg-zinc-100 text-zinc-900'
              : 'text-zinc-600'
          }`}
        >
          <div className="font-semibold">{item.title}</div>
          <div className="text-[11px] text-zinc-500">{item.description}</div>
        </div>
      ))}
    </div>
  );
}
