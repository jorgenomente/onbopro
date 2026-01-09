'use client';

import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type MyContext = {
  is_superadmin: boolean;
};

type SuperadminGuardProps = {
  children: ReactNode;
};

export default function SuperadminGuard({ children }: SuperadminGuardProps) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_my_context')
        .select('is_superadmin')
        .maybeSingle<MyContext>();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setAllowed(false);
        setLoading(false);
        return;
      }

      setAllowed(Boolean(data?.is_superadmin));
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 text-sm text-red-600 shadow-sm">
          Error: {error}
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
          No autorizado.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
