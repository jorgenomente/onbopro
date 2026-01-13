'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { diag } from '@/lib/diagnostics/diag';
import { instrumentedFetch } from '@/lib/diagnostics/instrumentedFetch';

export default function DevAuthDiagnostics() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const logSession = async (reason: string) => {
      const { data, error } = await supabase.auth.getSession();
      const session = data.session;
      const expiresAt = session?.expires_at ?? null;
      const secondsLeft = expiresAt
        ? Math.floor(expiresAt - Date.now() / 1000)
        : null;
      diag.log('auth_session', {
        reason,
        hasSession: Boolean(session),
        expiresAt,
        secondsLeft,
        error: error?.message ?? null,
      });
    };

    const handleFocus = () => {
      void logSession('focus');
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void logSession('visibility');
      }
    };

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        diag.log('auth_event', {
          event,
          hasSession: Boolean(session),
          expiresAt: session?.expires_at ?? null,
        });
      },
    );

    if (supabaseUrl) {
      void instrumentedFetch(
        `${supabaseUrl}/auth/v1/user`,
        {
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
        },
        {
          label: 'supabase-self-test',
        },
      ).catch(() => {
        // Expected to fail without auth; logging handled by instrumented fetch.
      });
    }

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      subscription?.subscription.unsubscribe();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return null;
}
