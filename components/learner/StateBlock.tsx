import type { ReactNode } from 'react';
import { Card } from './Card';

type StateBlockProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  tone?: 'error' | 'empty' | 'info';
  icon?: ReactNode;
};

export function StateBlock({
  title,
  description,
  actions,
  tone = 'info',
  icon,
}: StateBlockProps) {
  const toneClass =
    tone === 'error'
      ? 'text-red-600'
      : tone === 'empty'
        ? 'text-zinc-600'
        : 'text-zinc-700';

  return (
    <Card>
      <div className="flex items-start gap-3">
        {icon ? <div className="mt-1 text-zinc-400">{icon}</div> : null}
        <div>
          <p className={`text-sm font-semibold ${toneClass}`}>{title}</p>
          {description ? (
            <p className="mt-2 text-sm text-zinc-500">{description}</p>
          ) : null}
          {actions ? (
            <div className="mt-4 flex flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
