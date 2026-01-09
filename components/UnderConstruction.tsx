type MissingItem = { label: string; detail?: string };

type UnderConstructionProps = {
  title: string;
  description?: string;
  missing?: MissingItem[];
  primaryHint?: string;
};

export function UnderConstruction({
  title,
  description,
  missing = [],
  primaryHint,
}: UnderConstructionProps) {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6 rounded-3xl bg-white p-8 shadow-sm">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Funcionalidad en construcción. No operativa aún.
        </div>
        <div className="space-y-2">
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
            En construcción
          </span>
          <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
          {description ? (
            <p className="text-sm text-zinc-600">{description}</p>
          ) : null}
        </div>
        {missing.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-zinc-900">Qué falta</p>
            <ul className="space-y-2 text-sm text-zinc-600">
              {missing.map((item) => (
                <li key={item.label} className="flex gap-2">
                  <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-zinc-400" />
                  <span>
                    {item.label}
                    {item.detail ? (
                      <span className="text-zinc-500"> — {item.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          No se realizan cambios ni envíos desde esta pantalla.
        </div>
        {primaryHint ? (
          <p className="text-sm text-zinc-500">{primaryHint}</p>
        ) : null}
      </div>
    </div>
  );
}
