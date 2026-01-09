'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { invokeEdge } from '@/lib/invokeEdge';

type LocalContext = {
  org_id: string;
  org_name: string;
  org_status: 'active' | 'archived';
  local_id: string;
  local_name: string;
  local_status: 'active' | 'archived';
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

export default function SuperadminAddLocalMemberPage() {
  const params = useParams();
  const router = useRouter();
  const localId = params?.localId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [context, setContext] = useState<LocalContext | null>(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'aprendiz' | 'referente'>('aprendiz');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [inviteFallback, setInviteFallback] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_superadmin_local_context')
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

      setContext((data as LocalContext) ?? null);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [localId]);

  const handleSubmit = async () => {
    setFormError('');
    setToast('');
    setInviteFallback(false);

    const trimmedEmail = email.trim().toLowerCase();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!trimmedEmail || !isValidEmail) {
      setFormError('Ingresá un email válido.');
      return;
    }

    setSaving(true);
    const { error: rpcError } = await supabase.rpc(
      'rpc_superadmin_add_local_member',
      {
        p_local_id: localId,
        p_email: trimmedEmail,
        p_role: role,
      },
    );
    setSaving(false);

    if (rpcError) {
      console.debug('rpc_superadmin_add_local_member error', {
        code: rpcError.code,
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint,
      });
      const normalizedMessage = (rpcError.message ?? '').toLowerCase();
      const isUserNotFound =
        rpcError.code === '22023' ||
        normalizedMessage.includes('user not found');

      if (isUserNotFound) {
        setInviteFallback(true);
        return;
      }

      if (rpcError.code === '23505') {
        setFormError('El usuario ya pertenece a este local.');
      } else if (rpcError.code === '42501') {
        setFormError('No autorizado.');
      } else {
        setFormError(rpcError.message ?? 'Error al agregar miembro.');
      }
      return;
    }

    setToast('Miembro agregado.');
    router.push(`/superadmin/locals/${localId}/members?flash=member_added`);
  };

  const handleInvite = async () => {
    setFormError('');
    setToast('');

    const trimmedEmail = email.trim().toLowerCase();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!trimmedEmail || !isValidEmail) {
      setFormError('Ingresá un email válido.');
      return;
    }

    if (!context?.org_id || !context.local_id) {
      setFormError('Contexto inválido para enviar la invitación.');
      return;
    }

    setInviting(true);

    const { data, error: edgeError } = await invokeEdge<InviteResponse>(
      'provision_local_member',
      {
        org_id: context.org_id,
        local_id: context.local_id,
        email: trimmedEmail,
        role,
      },
    );

    setInviting(false);

    if (edgeError) {
      if (edgeError.status === 42501 || edgeError.status === 403) {
        setFormError('No autorizado.');
        return;
      }
      setFormError(
        formatEdgeError(
          edgeError.message ?? 'No se pudo enviar la invitación.',
          edgeError,
        ),
      );
      return;
    }

    if (!data) {
      setFormError('Respuesta inválida del servidor.');
      return;
    }

    if (data.result === 'invited') {
      setToast('Invitación enviada.');
      router.push(`/superadmin/locals/${localId}/members?flash=invited`);
      return;
    }

    if (data.result === 'member_added') {
      setToast('Miembro agregado.');
      router.push(`/superadmin/locals/${localId}/members?flash=member_added`);
      return;
    }

    setFormError('Respuesta inválida del servidor.');
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          className="text-xs font-semibold tracking-wide text-zinc-500 uppercase hover:text-zinc-700"
          href={`/superadmin/locals/${localId}/members`}
        >
          Volver a miembros
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Agregar miembro
        </h1>
        <p className="text-sm text-zinc-500">
          {context?.local_name ?? 'Local'} ·{' '}
          {context?.org_name ?? 'Organización'}
        </p>
      </header>

      {loading && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="h-6 w-40 animate-pulse rounded bg-zinc-100" />
          <div className="mt-4 h-4 w-64 animate-pulse rounded bg-zinc-100" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">Error: {error}</p>
        </div>
      )}

      {!loading && !error && !context && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-600">
            Local no encontrado o sin acceso.
          </p>
        </div>
      )}

      {!loading && !error && context && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Email
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
                placeholder="usuario@empresa.com"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setInviteFallback(false);
                }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Rol
              </label>
              <select
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
                value={role}
                onChange={(event) => {
                  setRole(event.target.value as 'aprendiz' | 'referente');
                  setInviteFallback(false);
                }}
              >
                <option value="aprendiz">Aprendiz</option>
                <option value="referente">Referente</option>
              </select>
            </div>
          </div>

          {inviteFallback && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Este email no tiene cuenta aún. Podés invitarlo y asignarlo a este
              local.
            </div>
          )}

          {formError && (
            <p className="mt-4 text-sm text-red-600">{formError}</p>
          )}
          {toast && <p className="mt-4 text-sm text-emerald-600">{toast}</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            {inviteFallback ? (
              <button
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={inviting}
                type="button"
                onClick={handleInvite}
              >
                {inviting ? 'Enviando…' : 'Invitar y asignar'}
              </button>
            ) : (
              <button
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
                type="button"
                onClick={handleSubmit}
              >
                {saving ? 'Guardando…' : 'Agregar miembro'}
              </button>
            )}
            <Link
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
              href={`/superadmin/locals/${localId}/members`}
            >
              {inviteFallback ? 'Volver' : 'Cancelar'}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
