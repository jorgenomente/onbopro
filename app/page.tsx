'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type MyContext = {
  is_superadmin: boolean;
  has_org_admin: boolean;
  org_admin_org_id: string | null;
  locals_count: number;
  primary_local_id: string | null;
};

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'error' | 'empty'>(
    'loading',
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('v_my_context')
        .select('*')
        .maybeSingle<MyContext>();

      if (!active) return;

      if (error) {
        setStatus('error');
        setMessage(error.message);
        return;
      }

      if (!data) {
        setStatus('error');
        setMessage('No pudimos determinar tu contexto.');
        return;
      }

      if (data.is_superadmin) {
        router.replace('/superadmin');
        return;
      }

      if (data.has_org_admin) {
        router.replace('/org/dashboard');
        return;
      }

      if (data.locals_count === 1 && data.primary_local_id) {
        router.replace(`/l/${data.primary_local_id}/dashboard`);
        return;
      }
      if (data.locals_count > 1) {
        router.replace('/select-local');
        return;
      }

      setStatus('empty');
      setMessage('No tenés locales asignados. Contactá a soporte.');
    };

    run();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
        {status === 'loading' && (
          <div className="text-sm text-zinc-500">Cargando...</div>
        )}
        {status === 'error' && (
          <div className="text-sm text-red-600">Error: {message}</div>
        )}
        {status === 'empty' && (
          <div className="text-sm text-zinc-600">{message}</div>
        )}
      </div>
    </div>
  );
}
