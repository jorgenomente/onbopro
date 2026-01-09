'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { invokeEdge } from '@/lib/invokeEdge';

type InvitationContext = {
  invitation_id: string;
  org_name: string;
  local_name: string | null;
  role: 'aprendiz' | 'referente' | 'org_admin';
  expires_at: string;
  email?: string | null;
};

type AcceptResponse = {
  ok: boolean;
  org_id: string;
  local_id: string;
  role: 'aprendiz' | 'referente';
  user_id: string;
  membership_id: string;
};

function formatEdgeError(
  message: string,
  edgeError?: {
    code?: string | null;
    details?: string | null;
    status?: number;
  },
) {
  const parts = [
    edgeError?.code ?? null,
    edgeError?.details ?? null,
    edgeError?.status ? String(edgeError.status) : null,
  ].filter(Boolean);

  return parts.length ? `${message} (${parts.join(' / ')})` : message;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function AcceptInvitationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<InvitationContext | null>(null);
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');
  const [existingFullName, setExistingFullName] = useState('');
  const [sessionEmail, setSessionEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loginRequired, setLoginRequired] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      if (!token) {
        setError('Token inválido o expirado.');
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!cancelled) {
        const session = sessionData.session;
        setHasSession(Boolean(session?.access_token));
        setSessionEmail(session?.user?.email ?? '');
        if (session?.user?.id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (!cancelled && profileData?.full_name) {
            setExistingFullName(profileData.full_name);
            setFullName(profileData.full_name);
          }
        }
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !anonKey) {
        setError('Configuración faltante.');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/v_invitation_public?select=*`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            'x-invite-token': token,
          },
        },
      );

      const payload = (await response.json()) as InvitationContext[];
      if (!response.ok || payload.length === 0) {
        setError('Token inválido o expirado.');
        setContext(null);
        setLoading(false);
        return;
      }

      setContext(payload[0]);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const canSubmit = useMemo(() => {
    if (loginRequired) return false;
    const normalizedName = fullName.trim();
    const needsName = existingFullName.trim().length === 0;
    const nameValid =
      !needsName ||
      (normalizedName.length >= 2 && normalizedName.length <= 100);
    return nameValid && password.length >= 8 && password === confirm;
  }, [password, confirm, loginRequired, fullName, existingFullName]);

  const handleSubmit = async () => {
    setSubmitError('');
    setLoginRequired(false);

    if (!token) {
      setSubmitError('Token inválido o expirado.');
      return;
    }

    if (loginRequired) {
      return;
    }

    if (password.length < 8) {
      setSubmitError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setSubmitError('Las contraseñas no coinciden.');
      return;
    }

    const normalizedName = fullName.trim();
    const needsName = existingFullName.trim().length === 0;
    if (needsName && normalizedName.length === 0) {
      setSubmitError('Ingresá tu nombre y apellido.');
      return;
    }
    if (
      normalizedName.length > 0 &&
      (normalizedName.length < 2 || normalizedName.length > 100)
    ) {
      setSubmitError('El nombre debe tener entre 2 y 100 caracteres.');
      return;
    }

    setSubmitting(true);

    if (hasSession) {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setSubmitting(false);
        setSubmitError(
          updateError.message ?? 'No se pudo actualizar la contraseña.',
        );
        return;
      }
    }

    const {
      data,
      error: edgeError,
      status,
    } = await invokeEdge<AcceptResponse>(
      'accept_invitation',
      {
        token,
        password: hasSession ? undefined : password,
        full_name: normalizedName.length > 0 ? normalizedName : undefined,
      },
      { anon: !hasSession },
    );

    setSubmitting(false);

    if (edgeError) {
      if (status === 409) {
        setLoginRequired(true);
        return;
      }
      setSubmitError(
        formatEdgeError(
          edgeError.message ?? 'No se pudo aceptar la invitación.',
          edgeError,
        ),
      );
      return;
    }

    if (!data?.ok) {
      setSubmitError('No se pudo aceptar la invitación.');
      return;
    }

    router.replace('/');
  };

  const emailFromInvitation = context?.email?.trim() || sessionEmail.trim();
  const isOrgAdminInvite = context?.role === 'org_admin';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <div className="h-64 w-full max-w-md animate-pulse rounded-3xl bg-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Invitación inválida
          </h1>
          <p className="text-sm text-zinc-600">{error}</p>
          <Link
            className="inline-flex rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
            href="/login"
          >
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md space-y-6 rounded-3xl bg-white p-8 shadow-sm">
        <div>
          <p className="text-xs tracking-wide text-zinc-500 uppercase">ONBO</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
            Aceptar invitación
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            {isOrgAdminInvite
              ? 'Te invitaron como Administrador de la organización'
              : 'Te invitaron a un local de la organización'}
          </p>
          <p className="text-sm text-zinc-600">
            Organización: {context?.org_name}
          </p>
          {!isOrgAdminInvite && (
            <>
              <p className="text-sm text-zinc-600">
                Local: {context?.local_name ?? '—'}
              </p>
              <p className="text-sm text-zinc-600">
                Rol: {context?.role === 'aprendiz' ? 'Aprendiz' : 'Referente'}
              </p>
            </>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            Expira el{' '}
            {context?.expires_at ? formatDate(context.expires_at) : '—'}
          </p>
        </div>

        {!loginRequired && (
          <div className="space-y-4">
            <input
              className="sr-only"
              type="email"
              value={emailFromInvitation}
              readOnly
              autoComplete="username"
              aria-hidden="true"
              tabIndex={-1}
            />
            <div>
              <label className="text-sm font-medium text-zinc-700">
                Nombre y apellido
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-zinc-400"
                type="text"
                placeholder="Ej: Juan Pérez"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required={existingFullName.trim().length === 0}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">
                Contraseña
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-zinc-400"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">
                Confirmar contraseña
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-zinc-400"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </div>
          </div>
        )}

        {loginRequired ? (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
            Ya tenés cuenta. Iniciá sesión para aceptar la invitación.
            <Link
              className="mt-3 inline-flex rounded-xl border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800"
              href={`/login?returnTo=${encodeURIComponent(
                `/auth/accept-invitation?token=${token}`,
              )}`}
            >
              Iniciar sesión
            </Link>
          </div>
        ) : null}

        {submitError ? (
          <p className="text-sm text-red-600">{submitError}</p>
        ) : null}

        <button
          className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? 'Aceptando...' : 'Aceptar invitación'}
        </button>

        <div className="text-center">
          <Link className="text-sm text-zinc-600" href="/login">
            ¿Ya tenés cuenta? Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
          <div className="h-64 w-full max-w-md animate-pulse rounded-3xl bg-white" />
        </div>
      }
    >
      <AcceptInvitationInner />
    </Suspense>
  );
}
