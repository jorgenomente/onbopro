'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type MyLocal = {
  local_id: string;
  local_name: string;
  org_id: string;
  membership_role: string;
  membership_status: string;
};

export default function SelectLocalPage() {
  const router = useRouter();
  const [locals, setLocals] = useState<MyLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace('/login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_superadmin')
        .eq('user_id', sessionData.session.user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (profile?.is_superadmin) {
        router.replace('/superadmin');
        return;
      }

      const { data, error: loadError } = await supabase
        .from('v_my_locals')
        .select('*');

      if (!active) return;

      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }

      setLocals((data ?? []) as MyLocal[]);
      setLoading(false);
    };

    load();

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <div className="text-sm text-zinc-500">Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <div className="text-sm text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Selecciona un local
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Tienes acceso a mas de un local. Elige donde continuar.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {locals.map((local) => (
            <button
              key={local.local_id}
              className="rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-zinc-300"
              onClick={() => router.push(`/l/${local.local_id}/dashboard`)}
              type="button"
            >
              <div className="text-sm text-zinc-500">{local.org_id}</div>
              <div className="mt-2 text-lg font-semibold text-zinc-900">
                {local.local_name}
              </div>
              <div className="mt-1 text-xs tracking-wide text-zinc-500 uppercase">
                {local.membership_role}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
