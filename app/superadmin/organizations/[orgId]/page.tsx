'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type LocalItem = {
  local_id: string;
  name: string;
  status: 'active' | 'archived';
  learners_count: number;
};

type AdminItem = {
  user_id: string;
  email: string;
  status: string;
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
  courses: CourseItem[];
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
  const courses = useMemo(() => row?.courses ?? [], [row]);

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
            <h2 className="text-sm font-semibold text-zinc-900">Locales</h2>
            {locals.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                No hay locales registrados.
              </p>
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
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles(
                        local.status === 'archived' ? 'archived' : 'active',
                      )}`}
                    >
                      {local.status === 'archived' ? 'Archivado' : 'Activo'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">
              Administradores
            </h2>
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
                    <span className="text-xs text-zinc-500">
                      {admin.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Cursos</h2>
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
