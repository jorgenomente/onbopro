'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/learner/Card';
import { logout } from '@/lib/auth/logout';

export default function NoAccessPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleGoDashboard = () => {
    router.push('/');
  };

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error('Logout failed', error);
      setSigningOut(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <Card className="w-full max-w-md space-y-4">
        <div>
          <p className="text-xs tracking-wide text-zinc-500 uppercase">ONBO</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
            Sin acceso
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            No tenés permisos para ver esta sección. Si creés que es un error,
            contactá a tu administrador.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="flex-1 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
            type="button"
            onClick={handleGoDashboard}
          >
            Ir al dashboard
          </button>
          <button
            className="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
          >
            {signingOut ? 'Saliendo…' : 'Cerrar sesión'}
          </button>
        </div>
      </Card>
    </div>
  );
}
