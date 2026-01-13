'use client';

import Link from 'next/link';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export default function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-2 text-xs text-zinc-500 ${className ?? ''}`}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const content = item.href ? (
          <Link className="font-semibold text-zinc-700" href={item.href}>
            {item.label}
          </Link>
        ) : (
          <span>{item.label}</span>
        );

        return (
          <span key={`${item.label}-${index}`} className="flex items-center">
            {content}
            {!isLast && <span className="px-2">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
