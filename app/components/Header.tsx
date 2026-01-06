'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type HeaderProps = {
  organizationName?: string;
  localName?: string;
};

type UserInfo = {
  email: string | null;
  orgName: string | null;
};

const HIDDEN_PATHS = new Set([
  '/',
  '/login',
  '/select-local',
  '/forgot-password',
  '/set-password',
]);

function isAuthRoute(pathname: string) {
  return pathname.startsWith('/auth');
}

function shortId(value: string) {
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function Header({ organizationName, localName }: HeaderProps) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo>({ email: null, orgName: null });
  const [signingOut, setSigningOut] = useState(false);

  const localId = typeof params?.localId === 'string' ? params.localId : null;
  const hideHeader =
    !pathname || HIDDEN_PATHS.has(pathname) || isAuthRoute(pathname);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error || !data.user) {
        setUser({ email: null, orgName: null });
        return;
      }

      const orgName =
        (data.user.user_metadata?.organization_name as string | undefined) ??
        (data.user.app_metadata?.organization_name as string | undefined) ??
        null;

      setUser({ email: data.user.email ?? null, orgName });
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const contextLabel = useMemo(() => {
    const orgLabel = organizationName ?? user.orgName ?? 'Organización —';
    const localLabel =
      localName ?? (localId ? `Local ${shortId(localId)}` : null);

    return { orgLabel, localLabel };
  }, [organizationName, user.orgName, localName, localId]);

  const handleLogoClick = () => {
    if (pathname?.startsWith('/superadmin')) {
      router.push('/superadmin/organizations');
      return;
    }
    if (pathname?.startsWith('/org')) {
      router.push('/org/dashboard');
      return;
    }
    if (pathname?.startsWith('/l') && localId) {
      router.push(`/l/${localId}/dashboard`);
      return;
    }
    router.push('/');
  };

  const handleLogout = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (hideHeader) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <button
          className="text-sm font-semibold tracking-wide text-zinc-900"
          type="button"
          onClick={handleLogoClick}
        >
          ONBO
        </button>
        <div className="flex items-center gap-4">
          <div className="hidden flex-col text-right text-xs text-zinc-500 sm:flex">
            <span className="truncate">{contextLabel.orgLabel}</span>
            {contextLabel.localLabel ? (
              <span className="truncate">{contextLabel.localLabel}</span>
            ) : null}
          </div>
          <div className="hidden max-w-[160px] truncate text-xs text-zinc-600 sm:block">
            {user.email ?? 'Usuario'}
          </div>
          <button
            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:opacity-50"
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
          >
            {signingOut ? 'Saliendo…' : 'Salir'}
          </button>
        </div>
      </div>
    </header>
  );
}
