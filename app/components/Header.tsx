'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { logout } from '@/lib/auth/logout';
import CompleteProfileModal from '@/components/profile/CompleteProfileModal';

type HeaderProps = {
  organizationName?: string;
  localName?: string;
};

type UserInfo = {
  email: string | null;
  orgName: string | null;
};

type MyContext = {
  is_superadmin: boolean;
  has_org_admin: boolean;
  org_admin_org_id: string | null;
  locals_count: number;
  primary_local_id: string | null;
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
  const [userId, setUserId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileRequired, setProfileRequired] = useState(false);
  const [context, setContext] = useState<MyContext | null>(null);
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
        setUserId(null);
        setProfileName('');
        setProfileRequired(false);
        return;
      }

      const orgName =
        (data.user.user_metadata?.organization_name as string | undefined) ??
        (data.user.app_metadata?.organization_name as string | undefined) ??
        null;

      setUser({ email: data.user.email ?? null, orgName });
      setUserId(data.user.id);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (cancelled) return;
      const existingName = profileData?.full_name?.trim() ?? '';
      setProfileName(existingName);
      setProfileRequired(existingName.length === 0);

      const { data: contextData } = await supabase
        .from('v_my_context')
        .select('*')
        .maybeSingle<MyContext>();

      if (cancelled) return;
      setContext(contextData ?? null);
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
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed', error);
      setSigningOut(false);
    }
  };

  const handleOrgMode = () => {
    router.push('/org/dashboard');
  };

  const handleLocalMode = () => {
    if (context?.primary_local_id) {
      router.push(`/l/${context.primary_local_id}/dashboard`);
      return;
    }
    router.push('/select-local');
  };

  const handleSuperadminMode = () => {
    router.push('/superadmin/organizations');
  };

  const showProfileModal =
    !isAuthRoute(pathname ?? '') && Boolean(userId) && profileRequired;
  const showOrgNav =
    Boolean(context?.has_org_admin) && pathname?.startsWith('/org');

  if (hideHeader && !showProfileModal) return null;

  return (
    <>
      {!hideHeader && (
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
              <div className="hidden items-center gap-2 text-xs sm:flex">
                {context?.is_superadmin ? (
                  <button
                    className="rounded-full border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                    type="button"
                    onClick={handleSuperadminMode}
                  >
                    Superadmin
                  </button>
                ) : null}
                {context?.has_org_admin ? (
                  <button
                    className="rounded-full border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                    type="button"
                    onClick={handleOrgMode}
                  >
                    Organización
                  </button>
                ) : null}
                {(context?.locals_count ?? 0) > 0 ? (
                  <button
                    className="rounded-full border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                    type="button"
                    onClick={handleLocalMode}
                  >
                    Local
                  </button>
                ) : null}
              </div>
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
          {showOrgNav ? (
            <div className="border-t border-zinc-100">
              <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-2 text-xs font-semibold text-zinc-600">
                <Link className="hover:text-zinc-900" href="/org/dashboard">
                  Dashboard
                </Link>
                <Link className="hover:text-zinc-900" href="/org/courses">
                  Cursos
                </Link>
                <Link className="hover:text-zinc-900" href="/org/alerts">
                  Alertas
                </Link>
                <Link className="hover:text-zinc-900" href="/org/invitations">
                  Invitaciones
                </Link>
                <Link className="hover:text-zinc-900" href="/org/courses/new">
                  Crear curso
                </Link>
              </nav>
            </div>
          ) : null}
        </header>
      )}
      {showProfileModal && (
        <CompleteProfileModal
          userId={userId}
          initialFullName={profileName}
          onSaved={(name) => {
            setProfileName(name);
            setProfileRequired(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
