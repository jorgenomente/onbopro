import type { ReactNode } from 'react';

type LearnerShellProps = {
  children: ReactNode;
  maxWidthClass?: string;
  paddedBottom?: boolean;
};

export function LearnerShell({
  children,
  maxWidthClass = 'max-w-5xl',
  paddedBottom = false,
}: LearnerShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div
        className={`mx-auto ${maxWidthClass} ${paddedBottom ? 'pb-28' : ''}`}
      >
        {children}
      </div>
    </div>
  );
}
