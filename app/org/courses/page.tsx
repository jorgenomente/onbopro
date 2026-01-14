'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { supabaseRest } from '@/lib/supabase/supabaseRest';
import { diag } from '@/lib/diagnostics/diag';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import { coursesIndexCrumbs } from '@/app/org/_lib/breadcrumbs';

type CourseStatus = 'draft' | 'published' | 'archived';

type OrgCourseRow = {
  org_id: string;
  course_id: string;
  title: string;
  status: CourseStatus;
  units_count: number;
  lessons_count: number;
  assigned_locals_count: number;
  assigned_locals_names: string[] | null;
  assigned_local_ids: string[] | null;
  org_locals: OrgLocalOption[] | null;
  learners_assigned_count: number;
  updated_at: string;
  published_at: string | null;
};

type OrgLocalOption = {
  local_id: string;
  name: string;
  status: 'active' | 'archived';
};

type FilterKey = 'all' | CourseStatus;

function statusLabel(status: CourseStatus) {
  if (status === 'published') return 'Activo';
  if (status === 'archived') return 'Archivado';
  return 'Borrador';
}

function statusClass(status: CourseStatus) {
  if (status === 'published') return 'bg-emerald-100 text-emerald-700';
  if (status === 'archived') return 'bg-zinc-200 text-zinc-700';
  return 'bg-amber-100 text-amber-700';
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

function assignmentLabel(names: string[], count: number) {
  if (count === 0) return 'No asignado a ningún local';
  if (count <= 2) return `Asignado a: ${names.join(', ')}`;
  return `Asignado a: ${count} locales`;
}

export default function OrgCoursesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authExpired, setAuthExpired] = useState(false);
  const [courses, setCourses] = useState<OrgCourseRow[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCourse, setAssignCourse] = useState<OrgCourseRow | null>(null);
  const [localsQuery, setLocalsQuery] = useState('');
  const [selectedLocalIds, setSelectedLocalIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const requestIdRef = useRef(0);
  const activeRequestRef = useRef<number | null>(null);

  const triggerFetch = () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    void fetchCourses(requestId);
  };

  const fetchCourses = async (requestId: number) => {
    console.log('[courses/page] 📚 fetchCourses START', { requestId });
    diag.log('courses_load', { step: 'start', pathname, requestId });
    setLoading(true);
    setError('');
    setAuthExpired(false);
    activeRequestRef.current = requestId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any;
    try {
      // IMPORTANT: We use supabaseRest instead of supabase.from() because
      // supabase.from() internally calls getSession() which hangs after tab switches.
      // supabaseRest reads the token directly from localStorage.

      console.log('[courses/page] 📚 About to call supabaseRest...');
      diag.log('courses_load', { step: 'before_query', pathname, requestId });

      const { data, error } = await supabaseRest('v_org_courses');
      response = { data, error };

      console.log('[courses/page] 📚 supabaseRest completed', {
        hasData: !!data,
        error,
      });
      diag.log('courses_load', { step: 'after_query', pathname, requestId });
    } catch (err) {
      // Standard error handling
      diag.log('query_error', {
        label: 'org_courses:list',
        requestId,
        error: String(err),
      });

      if (activeRequestRef.current !== requestId) return;
      const message = 'No pudimos cargar los cursos.';
      setError(message);
      setCourses([]);
      setLoading(false);
      activeRequestRef.current = null;
      return;
    }

    if (activeRequestRef.current !== requestId) return;
    const { data, error: fetchError } = response;

    if (fetchError) {
      const message = fetchError.message.toLowerCase();
      if (
        message.includes('jwt') ||
        message.includes('token') ||
        message.includes('expired')
      ) {
        setAuthExpired(true);
        setError('Tu sesión expiró. Volvé a iniciar sesión.');
      } else {
        setError(fetchError.message);
      }
      setCourses([]);
      setLoading(false);
      activeRequestRef.current = null;
      return;
    }

    setCourses((data as OrgCourseRow[]) ?? []);
    setLoading(false);
    activeRequestRef.current = null;
  };

  useEffect(() => {
    diag.log('courses_effect', { step: 'effect_enter', pathname });
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    void fetchCourses(requestId);

    return () => {
      if (activeRequestRef.current === requestId) {
        activeRequestRef.current = null;
      }
      diag.log('courses_effect', {
        step: 'effect_cleanup',
        pathname,
        requestId,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const filteredCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return courses.filter((course) => {
      if (filter !== 'all' && course.status !== filter) {
        return false;
      }
      if (!normalized) return true;
      return course.title.toLowerCase().includes(normalized);
    });
  }, [courses, filter, query]);

  const availableLocals = useMemo(() => {
    if (!assignCourse?.org_locals) return [];
    const normalized = localsQuery.trim().toLowerCase();
    if (!normalized) return assignCourse.org_locals;
    return assignCourse.org_locals.filter((local) =>
      local.name.toLowerCase().includes(normalized),
    );
  }, [assignCourse, localsQuery]);

  const hasAssignmentChanges = useMemo(() => {
    if (!assignCourse) return false;
    const current = new Set(assignCourse.assigned_local_ids ?? []);
    if (selectedLocalIds.length !== current.size) return true;
    return selectedLocalIds.some((id) => !current.has(id));
  }, [assignCourse, selectedLocalIds]);

  const openAssignModal = (course: OrgCourseRow) => {
    setAssignCourse(course);
    setSelectedLocalIds(course.assigned_local_ids ?? []);
    setLocalsQuery('');
    setAssignError('');
    setAssignOpen(true);
  };

  const handleToggleLocal = (localId: string) => {
    setSelectedLocalIds((prev) =>
      prev.includes(localId)
        ? prev.filter((id) => id !== localId)
        : [...prev, localId],
    );
  };

  const handleSaveAssignments = async () => {
    if (!assignCourse) return;
    setAssigning(true);
    setAssignError('');
    const { error: rpcError } = await supabase.rpc('rpc_set_course_locals', {
      p_course_id: assignCourse.course_id,
      p_local_ids: selectedLocalIds,
    });

    if (rpcError) {
      setAssignError(rpcError.message);
      setAssigning(false);
      return;
    }

    setAssigning(false);
    setAssignOpen(false);
    triggerFetch();
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="space-y-3">
          <Breadcrumbs items={coursesIndexCrumbs()} />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs tracking-wide text-zinc-500 uppercase">
                Org Admin
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
                Gerenciar Cursos
              </h1>
            </div>
            <div className="h-9 w-9 rounded-full border border-zinc-200 bg-white" />
          </div>
        </header>

        {loading && (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-24 animate-pulse rounded-2xl bg-white p-5 shadow-sm"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {!authExpired ? (
                <button
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
                  onClick={triggerFetch}
                  type="button"
                >
                  Reintentar
                </button>
              ) : null}
              {authExpired ? (
                <button
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.replace('/login');
                  }}
                >
                  Ir a login
                </button>
              ) : null}
            </div>
          </div>
        )}

        {!loading && !error && courses.length === 0 && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              Todavia no hay cursos creados.
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              Los cursos se crean desde la libreria de Superadmin y se copian a
              tu organizacion.
            </p>
            <button
              className="mt-4 rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm text-zinc-500"
              type="button"
              disabled
            >
              Crear curso (solo Superadmin)
            </button>
          </div>
        )}

        {!loading && !error && courses.length > 0 && (
          <>
            <section className="mt-8 space-y-4">
              <input
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-200 focus:outline-none"
                placeholder="Buscar por nombre de curso..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />

              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'Todos' },
                  { key: 'published', label: 'Activos' },
                  { key: 'draft', label: 'Borrador' },
                  { key: 'archived', label: 'Archivados' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      filter === tab.key
                        ? 'bg-zinc-900 text-white'
                        : 'border border-zinc-200 bg-white text-zinc-600'
                    }`}
                    onClick={() => setFilter(tab.key as FilterKey)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-8 space-y-4">
              <h2 className="text-lg font-semibold text-zinc-900">Cursos</h2>
              {filteredCourses.length === 0 && (
                <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                  No hay cursos que coincidan con este filtro.
                </div>
              )}
              {filteredCourses.map((course) => (
                <div
                  key={course.course_id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    router.push(`/org/courses/${course.course_id}/outline`)
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      router.push(`/org/courses/${course.course_id}/outline`);
                    }
                  }}
                  className="w-full rounded-2xl bg-white p-5 text-left shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-xs font-semibold text-zinc-600">
                        {course.title.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {course.title}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Ultima edicao: {formatDate(course.updated_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          course.status,
                        )}`}
                      >
                        {statusLabel(course.status)}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(
                            `/org/courses/${course.course_id}/outline`,
                          );
                        }}
                        aria-label={`Editar ${course.title}`}
                        className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(
                            `/org/courses/${course.course_id}/analytics`,
                          );
                        }}
                        aria-label={`Ver analytics del curso ${course.title}`}
                        className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                      >
                        Analytics
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openAssignModal(course);
                        }}
                        aria-label={`Asignar locales para ${course.title}`}
                        className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                      >
                        Asignar locales
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                    <span>{course.units_count} modulos</span>
                    <span>{course.lessons_count} lecciones</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    {assignmentLabel(
                      course.assigned_locals_names ?? [],
                      course.assigned_locals_count,
                    )}
                  </p>
                </div>
              ))}
            </section>
          </>
        )}
      </div>

      <div className="fixed right-6 bottom-8 flex flex-col items-end gap-2">
        <span className="rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-semibold tracking-wide text-white uppercase">
          Solo Superadmin
        </span>
        <button
          className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-xl text-zinc-500 shadow-lg"
          type="button"
          disabled
          aria-label="Crear curso (solo Superadmin)"
        >
          +
        </button>
      </div>

      {assignOpen && assignCourse ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-zinc-900">
              Asignar locales
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Seleccioná los locales que deben ver este curso.
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-zinc-600">
                Buscar local
              </label>
              <input
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
                value={localsQuery}
                onChange={(event) => setLocalsQuery(event.target.value)}
                placeholder="Buscar locales..."
              />
            </div>

            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
              {availableLocals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                  No hay locales disponibles.
                </div>
              ) : (
                availableLocals.map((local) => (
                  <label
                    key={local.local_id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-700"
                  >
                    <div>
                      <p className="font-semibold">{local.name}</p>
                      {local.status === 'archived' ? (
                        <p className="text-xs text-zinc-500">Archivado</p>
                      ) : null}
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                      checked={selectedLocalIds.includes(local.local_id)}
                      onChange={() => handleToggleLocal(local.local_id)}
                    />
                  </label>
                ))
              )}
            </div>

            {assignError ? (
              <p className="mt-3 text-sm text-red-600">{assignError}</p>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                type="button"
                onClick={() => setAssignOpen(false)}
                disabled={assigning}
              >
                Cancelar
              </button>
              <button
                className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                type="button"
                onClick={handleSaveAssignments}
                disabled={!hasAssignmentChanges || assigning}
              >
                {assigning ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
