'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { invokeEdge } from '@/lib/invokeEdge';
import { supabase } from '@/lib/supabase/client';

type LocalItem = {
  local_id: string;
  name: string;
  status: 'active' | 'archived';
  learners_count: number;
};

type AdminItem = {
  membership_id: string;
  user_id: string;
  email: string;
  full_name?: string | null;
  status: string;
};

type AdminInvitationItem = {
  invitation_id: string;
  email: string;
  invited_role: string;
  status: string;
  sent_at: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

type CourseItem = {
  course_id: string;
  title: string;
  status: string;
};

type OrgDetailRow = {
  org_id: string;
  name: string;
  status: 'active' | 'archived';
  created_at: string;
  locals: LocalItem[];
  admins: AdminItem[];
  admin_invitations: AdminInvitationItem[];
  courses: CourseItem[];
};

type ProvisionOrgAdminResponse = {
  ok: boolean;
  result?: 'member_added' | 'invited';
  mode?: 'assigned_existing_user' | 'invited_new_user';
  invitation_id?: string;
  membership_id?: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusStyles(status: OrgDetailRow['status']) {
  if (status === 'archived') {
    return 'bg-zinc-200 text-zinc-700';
  }
  return 'bg-emerald-100 text-emerald-700';
}

export default function SuperadminOrganizationDetailPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [row, setRow] = useState<OrgDetailRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminUpdatingId, setAdminUpdatingId] = useState<string | null>(null);
  const [adminResendingId, setAdminResendingId] = useState<string | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!orgId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_superadmin_organization_detail')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setRow(null);
        setLoading(false);
        return;
      }

      setRow((data as OrgDetailRow) ?? null);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [orgId, refreshKey]);

  const locals = useMemo(() => row?.locals ?? [], [row]);
  const admins = useMemo(() => row?.admins ?? [], [row]);
  const adminInvitations = useMemo(() => row?.admin_invitations ?? [], [row]);
  const courses = useMemo(() => row?.courses ?? [], [row]);

  const rawEmail = adminEmail ?? '';
  const normalizedEmail = rawEmail.replace(/\s+/g, '').toLowerCase();
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const showInvalidEmail = triedSubmit && !isValidEmail;

  const addAdmin = async () => {
    setAdminError('');
    setAdminSuccess('');
    setTriedSubmit(true);

    if (!normalizedEmail || !isValidEmail) {
      return;
    }

    setAdminError('');
    setAdminSaving(true);
    const { data, error: invokeError } =
      await invokeEdge<ProvisionOrgAdminResponse>('provision_org_admin', {
        org_id: orgId,
        email: normalizedEmail,
      });
    setAdminSaving(false);

    if (invokeError) {
      setAdminError(invokeError.message);
      return;
    }

    if (!data?.ok) {
      setAdminError('No se pudo completar la invitación.');
      return;
    }

    if (data.result === 'invited') {
      setAdminSuccess('Invitación enviada.');
    } else {
      setAdminSuccess('Administrador agregado.');
    }
    setAdminEmail('');
    setTriedSubmit(false);
    setRefreshKey((value) => value + 1);
  };

  const updateAdminStatus = async (
    membershipId: string,
    status: 'active' | 'inactive',
  ) => {
    setAdminError('');
    setAdminSuccess('');
    setAdminUpdatingId(membershipId);

    const { error: rpcError } = await supabase.rpc(
      'rpc_superadmin_set_org_membership_status',
      {
        p_membership_id: membershipId,
        p_status: status,
      },
    );

    setAdminUpdatingId(null);

    if (rpcError) {
      setAdminError(rpcError.message);
      return;
    }

    setAdminSuccess(
      status === 'inactive'
        ? 'Administrador desactivado.'
        : 'Administrador reactivado.',
    );
    setRefreshKey((value) => value + 1);
  };

  const resendAdminInvitation = async (invitationId: string) => {
    setAdminError('');
    setAdminSuccess('');
    setAdminResendingId(invitationId);

    const { error: resendError } = await invokeEdge('resend_invitation', {
      invitation_id: invitationId,
    });

    setAdminResendingId(null);

    if (resendError) {
      setAdminError(resendError.message);
      return;
    }

    setAdminSuccess('Invitación reenviada.');
    setRefreshKey((value) => value + 1);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            className="text-xs font-semibold tracking-wide text-zinc-500 uppercase hover:text-zinc-700"
            href="/superadmin/organizations"
          >
            Volver a organizaciones
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
            {row?.name ?? 'Detalle de organización'}
          </h1>
        </div>
        {row?.status ? (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusStyles(
              row.status,
            )}`}
          >
            {row.status === 'archived' ? 'Archivada' : 'Activa'}
          </span>
        ) : null}
      </header>

      {loading && (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`org-detail-skeleton-${index}`}
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

      {!loading && !error && !row && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-600">
            Organización no encontrada o sin acceso.
          </p>
        </div>
      )}

      {!loading && !error && row && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-xs tracking-wide text-zinc-500 uppercase">
                Locales
              </p>
              <p className="mt-3 text-3xl font-semibold text-zinc-900">
                {locals.length}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-xs tracking-wide text-zinc-500 uppercase">
                Admins
              </p>
              <p className="mt-3 text-3xl font-semibold text-zinc-900">
                {admins.length}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-xs tracking-wide text-zinc-500 uppercase">
                Cursos
              </p>
              <p className="mt-3 text-3xl font-semibold text-zinc-900">
                {courses.length}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-xs tracking-wide text-zinc-500 uppercase">
                Creada
              </p>
              <p className="mt-3 text-lg font-semibold text-zinc-900">
                {formatDate(row.created_at)}
              </p>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Locales</h2>
              <Link
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                href={`/superadmin/organizations/${row.org_id}/locals/new`}
              >
                Crear local
              </Link>
            </div>
            {locals.length === 0 ? (
              <div className="mt-4 space-y-3 rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                <p>No hay locales registrados.</p>
                <Link
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
                  href={`/superadmin/organizations/${row.org_id}/locals/new`}
                >
                  Crear el primer local
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {locals.map((local) => (
                  <div
                    key={local.local_id}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {local.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {local.learners_count} aprendices
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles(
                          local.status === 'archived' ? 'archived' : 'active',
                        )}`}
                      >
                        {local.status === 'archived' ? 'Archivado' : 'Activo'}
                      </span>
                      <Link
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                        href={`/superadmin/locals/${local.local_id}/members`}
                      >
                        Gestionar miembros →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Administradores
              </h2>
            </div>
            <div className="mt-4 space-y-3 rounded-xl border border-zinc-100 bg-zinc-50/60 p-4">
              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Agregar administrador
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
                  placeholder="admin@empresa.com"
                  type="email"
                  value={adminEmail}
                  onChange={(event) => {
                    const nextEmail = event.target.value;
                    setAdminEmail(nextEmail);
                    const nextNormalized = nextEmail
                      .replace(/\s+/g, '')
                      .toLowerCase();
                    const nextValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                      nextNormalized,
                    );
                    if (nextEmail.trim().length === 0) {
                      setAdminError('');
                      setTriedSubmit(false);
                      return;
                    }
                    if (nextValid) {
                      setAdminError('');
                      setTriedSubmit(false);
                    }
                  }}
                />
                <button
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={adminSaving || adminEmail.trim().length === 0}
                  type="button"
                  onClick={addAdmin}
                >
                  {adminSaving ? 'Agregando…' : 'Agregar'}
                </button>
              </div>
              {showInvalidEmail && (
                <p className="text-sm text-red-600">Ingresá un email válido.</p>
              )}
              {adminError && (
                <p className="text-sm text-red-600">{adminError}</p>
              )}
              {adminSuccess && (
                <p className="text-sm text-emerald-600">{adminSuccess}</p>
              )}
            </div>
            {admins.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                No hay administradores registrados.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {admins.map((admin) => (
                  <div
                    key={admin.user_id}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="text-sm font-semibold text-zinc-900">
                      {admin.email}
                    </p>
                    {admin.full_name ? (
                      <p className="text-xs text-zinc-500">{admin.full_name}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span>
                        {admin.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                      <button
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={adminUpdatingId === admin.membership_id}
                        type="button"
                        onClick={() =>
                          updateAdminStatus(
                            admin.membership_id,
                            admin.status === 'active' ? 'inactive' : 'active',
                          )
                        }
                      >
                        {adminUpdatingId === admin.membership_id
                          ? 'Actualizando…'
                          : admin.status === 'active'
                            ? 'Desactivar'
                            : 'Reactivar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Invitaciones
              </h2>
            </div>
            {adminInvitations.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                No hay invitaciones pendientes.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {adminInvitations.map((invite) => (
                  <div
                    key={invite.invitation_id}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {invite.email}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {invite.status === 'pending'
                          ? 'Pendiente'
                          : invite.status}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span>
                        Enviada:{' '}
                        {invite.sent_at ? formatDate(invite.sent_at) : '—'}
                      </span>
                      <button
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={adminResendingId === invite.invitation_id}
                        type="button"
                        onClick={() =>
                          resendAdminInvitation(invite.invitation_id)
                        }
                      >
                        {adminResendingId === invite.invitation_id
                          ? 'Reenviando…'
                          : 'Reenviar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Cursos</h2>
              <Link
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                href={`/superadmin/organizations/${row.org_id}/courses`}
              >
                Gestionar cursos
              </Link>
            </div>
            {courses.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                No hay cursos registrados.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {courses.map((course) => (
                  <div
                    key={course.course_id}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="text-sm font-semibold text-zinc-900">
                      {course.title}
                    </p>
                    <span className="text-xs text-zinc-500">
                      {course.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
