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

      const { data, error } = await supabase.from('v_my_locals').select('*');
      if (!active) return;

      if (error) {
        setStatus('error');
        setMessage(error.message);
        return;
      }

      const locals = (data ?? []) as MyLocal[];
      if (locals.length === 1) {
        router.replace(`/l/${locals[0].local_id}/dashboard`);
        return;
      }
      if (locals.length > 1) {
        router.replace('/select-local');
        return;
      }

      setStatus('empty');
      setMessage('No tenes locales asignados. Contacta a soporte.');
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
