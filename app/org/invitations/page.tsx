'use client';

import { useEffect, useMemo, useState } from 'react';
import { invokeEdge } from '@/lib/invokeEdge';
import { supabase } from '@/lib/supabase/client';

type InvitationRow = {
  invitation_id: string;
  email: string;
  org_id: string;
  local_id: string;
  local_name: string;
  role: 'aprendiz' | 'referente';
  status: 'pending' | 'accepted' | 'expired';
  sent_at: string | null;
  expires_at: string | null;
};

type FilterTab = 'all' | 'pending' | 'accepted' | 'expired';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusLabel(status: InvitationRow['status']) {
  if (status === 'accepted') return 'Aceptada';
  if (status === 'expired') return 'Expirada';
  return 'Pendiente';
}

function statusStyles(status: InvitationRow['status']) {
  if (status === 'accepted') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (status === 'expired') {
    return 'bg-zinc-200 text-zinc-700';
  }
  return 'bg-amber-100 text-amber-700';
}

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

export default function OrgInvitationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<InvitationRow[]>([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState('');
  const [actionToast, setActionToast] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_org_invitations')
        .select('*')
        .order('sent_at', { ascending: false });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as InvitationRow[]);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let scoped = rows;

    if (tab !== 'all') {
      scoped = scoped.filter((row) => row.status === tab);
    }

    if (!normalized) return scoped;
    return scoped.filter((row) => row.email.toLowerCase().includes(normalized));
  }, [query, rows, tab]);

  const handleResend = async (invitationId: string) => {
    setActionError('');
    setActionToast('');
    setActioningId(invitationId);

    const { error: edgeError } = await invokeEdge('resend_invitation', {
      invitation_id: invitationId,
    });

    setActioningId(null);

    if (edgeError) {
      const message = edgeError.message ?? 'No se pudo reenviar.';
      setActionError(formatEdgeError(message, edgeError));
      return;
    }

    setActionToast('Invitación reenviada.');
    setRefreshKey((value) => value + 1);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">
          Organización
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">Invitaciones</h1>
      </header>

      <input
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-200 focus:outline-none"
        placeholder="Buscar por email..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'accepted', 'expired'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              tab === item
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {item === 'all'
              ? 'Todas'
              : item === 'pending'
                ? 'Pendientes'
                : item === 'accepted'
                  ? 'Aceptadas'
                  : 'Expiradas'}
          </button>
        ))}
      </div>

      {actionError ? (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">
          {actionError}
        </div>
      ) : null}
      {actionToast ? (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
          {actionToast}
        </div>
      ) : null}

      {loading && (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`invite-skeleton-${index}`}
              className="h-24 animate-pulse rounded-2xl bg-white shadow-sm"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">Error: {error}</p>
          <button
            className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-600">
            No hay invitaciones para mostrar.
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4">
          {filtered.map((row) => (
            <div
              key={row.invitation_id}
              className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-zinc-900">
                    {row.email}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles(
                      row.status,
                    )}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  {row.role === 'aprendiz' ? 'Aprendiz' : 'Referente'} ·{' '}
                  {row.local_name}
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-zinc-600">
                  <span>Enviada: {formatDate(row.sent_at)}</span>
                  <span>Expira: {formatDate(row.expires_at)}</span>
                </div>
              </div>
              {row.status === 'pending' && (
                <button
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300 disabled:opacity-60"
                  type="button"
                  disabled={actioningId === row.invitation_id}
                  onClick={() => handleResend(row.invitation_id)}
                >
                  {actioningId === row.invitation_id
                    ? 'Reenviando...'
                    : 'Reenviar'}
                </button>
              )}
              {row.status === 'expired' && (
                <button
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300 disabled:opacity-60"
                  type="button"
                  disabled={actioningId === row.invitation_id}
                  onClick={() => handleResend(row.invitation_id)}
                >
                  {actioningId === row.invitation_id
                    ? 'Reenviando...'
                    : 'Reenviar'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
