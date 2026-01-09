'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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

type LocalMember = {
  membership_id: string;
  org_id: string;
  local_id: string;
  local_name: string;
  user_id: string;
  email: string;
  role: 'aprendiz' | 'referente';
  status: 'active' | 'inactive';
  is_primary: boolean;
  created_at: string;
  profile_exists: boolean;
  user_id_short: string;
  display_email: string;
  display_name: string;
};

type LocalInvitation = {
  invitation_id: string;
  org_id: string;
  local_id: string;
  email: string;
  invited_role: 'aprendiz' | 'referente' | 'org_admin';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  sent_at: string | null;
  expires_at: string;
  accepted_at: string | null;
};

type TabKey = 'aprendices' | 'referentes' | 'inactivos' | 'invitaciones';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'aprendices', label: 'Aprendices' },
  { key: 'referentes', label: 'Referentes' },
  { key: 'inactivos', label: 'Inactivos' },
  { key: 'invitaciones', label: 'Invitaciones' },
];

export default function SuperadminLocalMembersPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const localId = params?.localId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [context, setContext] = useState<LocalContext | null>(null);
  const [members, setMembers] = useState<LocalMember[]>([]);
  const [invitations, setInvitations] = useState<LocalInvitation[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('aprendices');
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [refreshWarning, setRefreshWarning] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<LocalMember | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const didConsumeFlash = useRef(false);
  const flashMessage = useMemo(() => {
    const flash = searchParams?.get('flash');
    if (flash === 'invited') return 'Invitación enviada';
    if (flash === 'member_added') return 'Miembro agregado';
    return '';
  }, [searchParams]);
  const [refreshKey, setRefreshKey] = useState(() => (flashMessage ? 1 : 0));

  useEffect(() => {
    if (didConsumeFlash.current) return;
    if (!localId) return;
    if (!flashMessage) return;

    didConsumeFlash.current = true;
    router.replace(`/superadmin/locals/${localId}/members`, { scroll: false });
  }, [flashMessage, localId, router]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localId) return;
      setLoading(true);
      setError('');

      const { data: contextData, error: contextError } = await supabase
        .from('v_superadmin_local_context')
        .select('*')
        .eq('local_id', localId)
        .maybeSingle();

      if (cancelled) return;

      if (contextError) {
        setError(contextError.message);
        setContext(null);
        setMembers([]);
        setLoading(false);
        return;
      }

      const { data: membersData, error: membersError } = await supabase
        .from('v_superadmin_local_members')
        .select('*')
        .eq('local_id', localId);

      if (cancelled) return;

      if (membersError) {
        setError(membersError.message);
        if (flashMessage) {
          setRefreshWarning(
            'No se pudo refrescar la lista, recargá la página.',
          );
        }
        setContext(contextData as LocalContext | null);
        setMembers([]);
        setInvitations([]);
        setLoading(false);
        return;
      }

      const { data: invitationData, error: invitationError } = await supabase
        .from('v_superadmin_local_invitations')
        .select('*')
        .eq('local_id', localId);

      if (cancelled) return;

      if (invitationError) {
        setError(invitationError.message);
        setContext(contextData as LocalContext | null);
        setMembers((membersData as LocalMember[]) ?? []);
        setInvitations([]);
        setLoading(false);
        return;
      }

      if (process.env.NODE_ENV !== 'production') {
        const sample = (membersData as LocalMember[] | null)?.[0];
        console.info('[superadmin members] loaded', {
          localId,
          count: (membersData as LocalMember[] | null)?.length ?? 0,
          sample: sample
            ? {
                membership_id: sample.membership_id,
                user_id: sample.user_id,
                role: sample.role,
                status: sample.status,
              }
            : null,
        });
      }

      setContext((contextData as LocalContext) ?? null);
      setMembers((membersData as LocalMember[]) ?? []);
      setInvitations((invitationData as LocalInvitation[]) ?? []);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [flashMessage, localId, refreshKey]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return members.filter((member) => {
      const displayEmail = (member.display_email || member.email).toLowerCase();
      const matchesSearch = query.length === 0 || displayEmail.includes(query);

      if (!matchesSearch) return false;

      if (activeTab === 'inactivos') return member.status === 'inactive';
      if (activeTab === 'referentes') {
        return member.role === 'referente' && member.status === 'active';
      }
      return member.role === 'aprendiz' && member.status === 'active';
    });
  }, [members, search, activeTab]);

  const filteredInvitations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invitations.filter((invitation) => {
      return (
        query.length === 0 || invitation.email.toLowerCase().includes(query)
      );
    });
  }, [invitations, search]);

  const handleResendInvitation = async (invitationId: string) => {
    setActionError('');
    setActionSuccess('');
    setResendingId(invitationId);

    const { error } = await invokeEdge('resend_invitation', {
      invitation_id: invitationId,
    });

    setResendingId(null);

    if (error) {
      setActionError(error.message ?? 'No se pudo reenviar la invitación.');
      return;
    }

    setActionSuccess('Invitación reenviada.');
    setRefreshKey((value) => value + 1);
  };

  const openNameModal = (member: LocalMember) => {
    setEditingMember(member);
    setNameInput(member.display_name || '');
    setNameError('');
  };

  const closeNameModal = () => {
    setEditingMember(null);
    setNameInput('');
    setNameError('');
  };

  const canSaveName = useMemo(() => {
    const trimmed = nameInput.trim();
    return trimmed.length >= 2 && trimmed.length <= 100;
  }, [nameInput]);

  const handleSaveName = async () => {
    if (!editingMember) return;
    const trimmed = nameInput.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      setNameError('El nombre debe tener entre 2 y 100 caracteres.');
      return;
    }

    setSavingName(true);
    setNameError('');
    setActionError('');
    setActionSuccess('');

    const { error } = await invokeEdge('superadmin_update_profile_name', {
      target_user_id: editingMember.user_id,
      full_name: trimmed,
    });

    setSavingName(false);

    if (error) {
      setNameError(error.message ?? 'No se pudo actualizar el nombre.');
      return;
    }

    setActionSuccess('Nombre actualizado.');
    setMembers((prev) =>
      prev.map((member) =>
        member.user_id === editingMember.user_id
          ? {
              ...member,
              display_name: trimmed,
              profile_exists: true,
            }
          : member,
      ),
    );
    setRefreshKey((value) => value + 1);
    closeNameModal();
  };

  const toggleMembership = async (member: LocalMember) => {
    setActionError('');
    setActionSuccess('');

    const shouldDeactivate = member.status === 'active';
    if (
      shouldDeactivate &&
      !window.confirm('¿Querés desactivar este miembro?')
    ) {
      return;
    }

    setUpdatingId(member.membership_id);

    const { error: rpcError } = await supabase.rpc(
      'rpc_superadmin_set_local_membership_status',
      {
        p_membership_id: member.membership_id,
        p_status: shouldDeactivate ? 'inactive' : 'active',
      },
    );

    setUpdatingId(null);

    if (rpcError) {
      setActionError(rpcError.message);
      return;
    }

    setActionSuccess(
      shouldDeactivate ? 'Miembro desactivado.' : 'Miembro reactivado.',
    );
    setRefreshKey((value) => value + 1);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          className="text-xs font-semibold tracking-wide text-zinc-500 uppercase hover:text-zinc-700"
          href={
            context
              ? `/superadmin/organizations/${context.org_id}`
              : '/superadmin/organizations'
          }
        >
          Volver a organización
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">
              Miembros del local
            </h1>
            <p className="text-sm text-zinc-500">
              {context?.local_name ?? 'Local'} ·{' '}
              {context?.org_name ?? 'Organización'}
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
            href={`/superadmin/locals/${localId}/members/new`}
          >
            Agregar miembro
          </Link>
        </div>
      </header>

      {loading && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="h-6 w-32 animate-pulse rounded bg-zinc-100" />
          <div className="mt-4 h-4 w-64 animate-pulse rounded bg-zinc-100" />
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

      {!loading && !error && !context && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-600">
            Local no encontrado o sin acceso.
          </p>
        </div>
      )}

      {!loading && !error && context && (
        <>
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      activeTab === tab.key
                        ? 'bg-zinc-900 text-white'
                        : 'border border-zinc-200 text-zinc-600 hover:border-zinc-300'
                    }`}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <input
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none sm:max-w-xs"
                placeholder="Buscar por email"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {flashMessage && (
              <p className="mt-4 text-sm text-emerald-600">{flashMessage}</p>
            )}
            {refreshWarning && (
              <p className="mt-2 text-sm text-amber-600">{refreshWarning}</p>
            )}
            {actionError && (
              <p className="mt-4 text-sm text-red-600">{actionError}</p>
            )}
            {actionSuccess && (
              <p className="mt-4 text-sm text-emerald-600">{actionSuccess}</p>
            )}

            {activeTab !== 'invitaciones' && filteredMembers.length === 0 ? (
              <p className="mt-6 text-sm text-zinc-500">
                No hay miembros para este filtro.
              </p>
            ) : null}

            {activeTab !== 'invitaciones' && filteredMembers.length > 0 ? (
              <div className="mt-6 space-y-3">
                {filteredMembers.map((member) =>
                  (() => {
                    const displayEmail = member.display_email || member.email;
                    const fallbackId =
                      member.user_id_short || member.user_id.slice(0, 8);
                    return (
                      <div
                        key={member.membership_id}
                        className="flex flex-col gap-2 rounded-xl border border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">
                            {displayEmail || fallbackId}
                          </p>
                          {member.display_name && (
                            <p className="mt-1 text-sm text-zinc-600">
                              {member.display_name}
                            </p>
                          )}
                          {!member.profile_exists && (
                            <p className="mt-1 text-xs text-zinc-500">
                              Sin perfil · {fallbackId}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                            <span className="rounded-full bg-zinc-100 px-2 py-1">
                              {member.role === 'aprendiz'
                                ? 'Aprendiz'
                                : 'Referente'}
                            </span>
                            <span className="rounded-full bg-zinc-100 px-2 py-1">
                              {member.status === 'active'
                                ? 'Activo'
                                : 'Inactivo'}
                            </span>
                            {!member.profile_exists && (
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                                Sin perfil
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={updatingId === member.membership_id}
                          type="button"
                          onClick={() => toggleMembership(member)}
                        >
                          {updatingId === member.membership_id
                            ? 'Actualizando…'
                            : member.status === 'active'
                              ? 'Desactivar'
                              : 'Reactivar'}
                        </button>
                        <button
                          className="text-xs font-semibold text-zinc-600 hover:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          onClick={() => openNameModal(member)}
                        >
                          Editar nombre
                        </button>
                      </div>
                    );
                  })(),
                )}
              </div>
            ) : null}

            {activeTab === 'invitaciones' &&
            filteredInvitations.length === 0 ? (
              <p className="mt-6 text-sm text-zinc-500">
                No hay invitaciones para este local.
              </p>
            ) : null}

            {activeTab === 'invitaciones' && filteredInvitations.length > 0 ? (
              <div className="mt-6 space-y-3">
                {filteredInvitations.map((invitation) => (
                  <div
                    key={invitation.invitation_id}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {invitation.email}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                        <span className="rounded-full bg-zinc-100 px-2 py-1">
                          {invitation.invited_role === 'aprendiz'
                            ? 'Aprendiz'
                            : invitation.invited_role === 'referente'
                              ? 'Referente'
                              : 'Org admin'}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2 py-1">
                          {invitation.status === 'pending'
                            ? 'Pendiente'
                            : invitation.status === 'accepted'
                              ? 'Aceptada'
                              : invitation.status === 'expired'
                                ? 'Expirada'
                                : 'Revocada'}
                        </span>
                        {invitation.sent_at && (
                          <span className="rounded-full bg-zinc-100 px-2 py-1">
                            Enviada:{' '}
                            {new Date(invitation.sent_at).toLocaleDateString()}
                          </span>
                        )}
                        {invitation.expires_at && (
                          <span className="rounded-full bg-zinc-100 px-2 py-1">
                            Expira:{' '}
                            {new Date(
                              invitation.expires_at,
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={resendingId === invitation.invitation_id}
                      type="button"
                      onClick={() =>
                        handleResendInvitation(invitation.invitation_id)
                      }
                    >
                      {resendingId === invitation.invitation_id
                        ? 'Reenviando…'
                        : 'Reenviar'}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {editingMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Editar nombre
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {editingMember.display_email ||
                    editingMember.email ||
                    editingMember.user_id}
                </p>
                <div className="mt-4 space-y-2">
                  <label className="text-sm font-medium text-zinc-700">
                    Nombre y apellido
                  </label>
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    type="text"
                    placeholder="Ej: Juan Pérez"
                    value={nameInput}
                    onChange={(event) => setNameInput(event.target.value)}
                  />
                  {nameError && (
                    <p className="text-sm text-red-600">{nameError}</p>
                  )}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={!canSaveName || savingName}
                    onClick={handleSaveName}
                  >
                    {savingName ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
                    type="button"
                    onClick={closeNameModal}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
