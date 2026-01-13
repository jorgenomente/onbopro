'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { recheckSession } from '@/lib/sessionRecheck';

const THROTTLE_MS = 7000;
const MOUNT_DELAY_MS = 1000;

export default function SessionRevalidateOnFocus() {
  const router = useRouter();
  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);
  const lastTokenRef = useRef<string | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    let active = true;

    // Delay enabling the revalidation to avoid interfering with initial page load
    const mountTimeout = setTimeout(() => {
      hasMountedRef.current = true;
    }, MOUNT_DELAY_MS);

    const logDev = (message: string, data?: Record<string, unknown>) => {
      if (process.env.NODE_ENV === 'production') return;
      if (data) {
        console.info(`[session-revalidate] ${message}`, data);
      } else {
        console.info(`[session-revalidate] ${message}`);
      }
    };

    const run = async () => {
      if (!active) return;
      if (inFlightRef.current) return;
      const now = Date.now();
      if (now - lastRunRef.current < THROTTLE_MS) return;

      inFlightRef.current = true;
      lastRunRef.current = now;

      try {
        logDev('revalidate start');
        const result = await recheckSession(supabase);
        if (!active) return;
        if (!result.ok) {
          logDev('no session, signing out');
          await supabase.auth.signOut();
          router.replace('/login');
          return;
        }

        if (result.token && result.token !== lastTokenRef.current) {
          lastTokenRef.current = result.token;
          logDev('session token updated, refreshing UI');
          router.refresh();
        } else {
          logDev('session ok, no refresh needed');
        }
      } catch (err) {
        logDev('revalidate error', {
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        inFlightRef.current = false;
      }
    };

    const handleFocus = () => {
      // Skip running during initial mount to avoid race conditions with page.tsx
      if (!hasMountedRef.current) return;
      void run();
    };

    const handleVisibility = () => {
      // Skip running during initial mount to avoid race conditions with page.tsx
      if (!hasMountedRef.current) return;
      if (document.visibilityState === 'visible') {
        void run();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      clearTimeout(mountTimeout);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [router]);

  return null;
}
