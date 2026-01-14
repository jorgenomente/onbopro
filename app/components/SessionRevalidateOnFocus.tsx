'use client';

import { useEffect, useRef } from 'react';
import { diag } from '@/lib/diagnostics/diag';

/**
 * SessionRevalidateOnFocus - Forces page reload after tab is hidden for too long.
 *
 * WHY: The supabase-js client has internal locks that can get stuck after
 * browser tab sleep/switch. When this happens, ALL supabase.* calls hang
 * indefinitely. The only reliable fix is a full page reload which resets
 * the entire JS runtime and creates a fresh Supabase client.
 *
 * This approach:
 * 1. Is guaranteed to work (fresh client)
 * 2. Is transparent to the user (just a quick reload)
 * 3. Only triggers after significant tab hide time (5+ seconds)
 */
export default function SessionRevalidateOnFocus() {
  const hiddenAtRef = useRef<number | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    // Delay enabling to avoid interfering with initial page load
    const mountTimeout = setTimeout(() => {
      hasMountedRef.current = true;
    }, 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        diag.log('tab_hidden', { at: Date.now() });
        console.log('[SessionRevalidate] 📴 Tab hidden');
      } else if (document.visibilityState === 'visible') {
        const hiddenDuration = hiddenAtRef.current
          ? Date.now() - hiddenAtRef.current
          : 0;

        diag.log('tab_visible', { at: Date.now(), hiddenDuration });
        console.log('[SessionRevalidate] 📱 Tab visible', { hiddenDuration });

        // Always reload when returning from hidden (any duration)
        // The supabase client can get poisoned even with brief tab switches
        if (hasMountedRef.current && hiddenAtRef.current !== null) {
          console.log(
            '[SessionRevalidate] 🔄 Forcing page reload (supabase client poisoned)',
          );
          diag.log('page_reload_forced', {
            reason: 'tab_was_hidden',
            hiddenDuration,
          });

          // Small delay to let the DOM stabilize
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }

        hiddenAtRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(mountTimeout);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return null;
}
