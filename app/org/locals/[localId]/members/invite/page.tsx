'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { invokeEdge } from '@/lib/invokeEdge';

type LocalContext = {
  org_id: string;
  org_name: string;
  local_id: string;
  local_name: string;
  local_status: string;
};

type InviteResponse =
  | {
      result: 'member_added';
      user_id: string;
      membership_id: string;
      invitation_id?: string | null;
    }
  | {
      result: 'invited';
      user_id: null;
      membership_id?: string | null;
      invitation_id: string;
    };

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export default function InviteLocalMemberPage() {
  const router = useRouter();
  const params = useParams();
  const localId = params.localId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [context, setContext] = useState<LocalContext | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'aprendiz' | 'referente'>('aprendiz');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_org_local_context')
        .select('*')
        .eq('local_id', localId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setContext(null);
        setLoading(false);
        return;
      }

      setContext((data ?? null) as LocalContext | null);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [localId]);

  const canSubmit = useMemo(() => {
    return emailRegex.test(email.trim());
  }, [email]);

  const handleSubmit = async () => {
    setSubmitError('');
    setToast('');

    const normalized = email.trim().toLowerCase();
    if (!emailRegex.test(normalized)) {
      setSubmitError('Ingresá un email válido.');
      return;
    }

    if (!context?.org_id || !context.local_id) {
      setSubmitError('Contexto inválido para enviar la invitación.');
      return;
    }

    setSubmitting(true);

    const { data, error: edgeError } = await invokeEdge<InviteResponse>(
      'provision_local_member',
      {
        org_id: context.org_id,
        local_id: context.local_id,
        email: normalized,
        role,
      },
    );

    setSubmitting(false);

    if (edgeError) {
      const message = edgeError.message ?? 'No se pudo enviar la invitación.';
      if (edgeError.status === 42501 || edgeError.status === 403) {
        setSubmitError('No autorizado.');
        return;
      }
      if (edgeError.status === 22023) {
        setSubmitError(formatEdgeError(message, edgeError));
        return;
      }
      setSubmitError(formatEdgeError(message, edgeError));
      return;
    }

    if (!data) {
      setSubmitError('Respuesta inválida del servidor.');
      return;
    }

    if (data.result === 'member_added') {
      setToast('Usuario agregado al local.');
      setEmail('');
      return;
    }

    setToast('Invitación enviada.');
    setEmail('');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded-full bg-zinc-200" />
        <div className="h-32 animate-pulse rounded-2xl bg-white shadow-sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Error: {error}</p>
        <Link
          className="mt-4 inline-flex rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
          href={`/org/locals/${localId}`}
        >
          Volver
        </Link>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-600">
          No tenés acceso a este local o no existe.
        </p>
        <button
          className="mt-4 inline-flex rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
          type="button"
          onClick={() => router.back()}
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">
          Organización · {context.org_name}
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Invitar usuario
        </h1>
        <p className="text-sm text-zinc-600">Local: {context.local_name}</p>
      </header>

      <div className="space-y-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">Email</label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            placeholder="nombre@empresa.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-700">Rol</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['aprendiz', 'referente'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRole(item)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium ${
                  role === item
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 text-zinc-700 hover:border-zinc-300'
                }`}
              >
                {item === 'aprendiz' ? 'Aprendiz' : 'Referente'}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-3 text-sm text-zinc-500">
          Código interno (opcional). Disponible próximamente.
        </div>

        {submitError ? (
          <p className="text-sm text-red-600">{submitError}</p>
        ) : null}
        {toast ? <p className="text-sm text-emerald-600">{toast}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            type="button"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Enviando...' : 'Enviar invitación'}
          </button>
          <Link
            className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
            href={`/org/locals/${localId}`}
          >
            Volver
          </Link>
        </div>
      </div>
    </div>
  );
}
