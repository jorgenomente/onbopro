'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { invokeEdge } from '@/lib/invokeEdge';
import { supabase } from '@/lib/supabase/client';
import { supabaseRest } from '@/lib/supabase/supabaseRest';
import InviteMemberModal, {
  InviteMemberResult,
} from '@/components/org/invitations/InviteMemberModal';
import InvitationsList from '@/components/org/invitations/InvitationsList';
import { InvitationRow } from '@/components/org/invitations/InvitationCard';

type FilterTab = 'all' | 'pending' | 'accepted' | 'expired';

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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<InvitationRow[]>([]);
  const [orgLocals, setOrgLocals] = useState<
    { local_id: string; local_name: string }[]
  >([]);
  const [orgId, setOrgId] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState('');
  const [actionToast, setActionToast] = useState('');
  const [authExpired, setAuthExpired] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      // Using supabaseRest to bypass supabase-js client which hangs after tab switch
      const { data, error: fetchError } = await supabaseRest<InvitationRow>(
        'v_org_invitations',
        { order: { column: 'sent_at', ascending: false } },
      );

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const invitations = (data ?? []) as InvitationRow[];
      setRows(invitations);
      const localsMap = new Map<
        string,
        { local_id: string; local_name: string }
      >();
      invitations.forEach((row) => {
        if (row.local_id && row.local_name) {
          localsMap.set(row.local_id, {
            local_id: row.local_id,
            local_name: row.local_name,
          });
        }
      });
      setOrgLocals(Array.from(localsMap.values()));
      setOrgId(invitations[0]?.org_id ?? '');
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
    setAuthExpired(false);
    setActioningId(invitationId);

    try {
      const { error: edgeError } = await invokeEdge('resend_invitation', {
        invitation_id: invitationId,
      });

      if (edgeError) {
        if (edgeError.code === 'AUTH_EXPIRED') {
          setAuthExpired(true);
          setActionError('Tu sesión expiró. Volvé a iniciar sesión.');
          return;
        }
        const message = edgeError.message ?? 'No se pudo reenviar.';
        setActionError(formatEdgeError(message, edgeError));
        return;
      }

      setActionToast('Invitación reenviada.');
      setRefreshKey((value) => value + 1);
    } finally {
      setActioningId(null);
    }
  };

  const handleInviteSuccess = (result?: InviteMemberResult) => {
    if (result === 'member_added') {
      setActionToast('Miembro agregado.');
    } else if (result === 'invited') {
      setActionToast('Invitación enviada.');
    }
    setRefreshKey((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-zinc-500 uppercase">
              Org Admin
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
              Invitaciones
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Gestioná las invitaciones a tu organización y locales.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              type="button"
              onClick={() => setInviteOpen(true)}
            >
              Invitar miembro
            </button>
            <div className="h-9 w-9 rounded-full border border-zinc-200 bg-white" />
          </div>
        </header>

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <input
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-200 focus:outline-none lg:max-w-md"
                placeholder="Buscar por email..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {(['all', 'pending', 'accepted', 'expired'] as const).map(
                  (item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTab(item)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                        tab === item
                          ? 'bg-zinc-900 text-white'
                          : 'border border-zinc-200 bg-white text-zinc-600'
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
                  ),
                )}
              </div>
            </div>

            {actionError ? (
              <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">
                <p>{actionError}</p>
                {authExpired ? (
                  <button
                    className="mt-3 inline-flex rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:border-red-300"
                    type="button"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      router.replace('/login');
                    }}
                  >
                    Ir a iniciar sesión
                  </button>
                ) : null}
              </div>
            ) : null}
            {actionToast ? (
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
                {actionToast}
              </div>
            ) : null}

            {loading && (
              <div className="grid gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`invite-skeleton-${index}`}
                    className="h-20 animate-pulse rounded-2xl bg-zinc-50"
                  />
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="rounded-2xl bg-zinc-50 p-5 text-sm text-red-600">
                <p>Error: {error}</p>
                <button
                  className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
                  type="button"
                  onClick={() => setRefreshKey((value) => value + 1)}
                >
                  Reintentar
                </button>
              </div>
            )}

            {!loading && !error && (
              <InvitationsList
                rows={filtered}
                onResend={handleResend}
                actioningId={actioningId}
              />
            )}
          </div>
        </div>
      </div>

      <InviteMemberModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        orgId={orgId}
        locals={orgLocals}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}
