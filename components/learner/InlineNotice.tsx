import type { ReactNode } from 'react';

type InlineNoticeProps = {
  tone: 'success' | 'error' | 'info';
  children: ReactNode;
};

export function InlineNotice({ tone, children }: InlineNoticeProps) {
  const styles =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'error'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-zinc-200 bg-zinc-50 text-zinc-700';

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`.trim()}>
      {children}
    </div>
  );
}
