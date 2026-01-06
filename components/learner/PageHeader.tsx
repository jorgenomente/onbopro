import type { ReactNode } from 'react';

type PageHeaderProps = {
  label?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({
  label,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {label ? (
          <p className="text-xs tracking-wide text-zinc-500 uppercase">
            {label}
          </p>
        ) : null}
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="self-start">{actions}</div> : null}
    </header>
  );
}
