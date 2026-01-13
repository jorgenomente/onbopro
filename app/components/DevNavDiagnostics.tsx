'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { diag } from '@/lib/diagnostics/diag';

export default function DevNavDiagnostics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathRef = useRef<string | null>(null);
  const lastSearchRef = useRef<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    const nextPath = pathname ?? '';
    const nextSearch = searchParams?.toString() ?? '';

    if (
      lastPathRef.current !== nextPath ||
      lastSearchRef.current !== nextSearch
    ) {
      console.info('[nav-debug] path change', {
        from: lastPathRef.current,
        to: nextPath,
        search: nextSearch,
        at: new Date().toISOString(),
      });
      diag.log('path_change', {
        from: lastPathRef.current,
        to: nextPath,
        search: nextSearch,
      });
      lastPathRef.current = nextPath;
      lastSearchRef.current = nextSearch;
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    const onFocus = () => {
      console.info('[nav-debug] window focus', {
        at: new Date().toISOString(),
      });
      diag.log('focus', {});
    };

    const onVisibility = () => {
      console.info('[nav-debug] visibility change', {
        state: document.visibilityState,
        at: new Date().toISOString(),
      });
      diag.log('visibility', { state: document.visibilityState });
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;
      console.info('[nav-debug] nav click', {
        href: anchor.getAttribute('href'),
        at: new Date().toISOString(),
      });
      diag.log('nav_click', { href: anchor.getAttribute('href') });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.warn('[nav-debug] unhandledrejection', {
        reason: String(event.reason ?? 'unknown'),
        at: new Date().toISOString(),
      });
      diag.log('unhandledrejection', {
        reason: String(event.reason ?? 'unknown'),
      });
    };

    const onError = (event: ErrorEvent) => {
      console.warn('[nav-debug] error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        at: new Date().toISOString(),
      });
      diag.log('error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('click', onClick, true);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

  return null;
}
