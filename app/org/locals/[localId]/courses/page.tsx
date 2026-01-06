'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type CourseRow = {
  org_id: string;
  local_id: string;
  course_id: string;
  title: string;
  course_status: string;
  assignment_status: 'active' | 'archived' | null;
  is_assigned: boolean;
  assigned_at: string | null;
  archived_at: string | null;
  category: string | null;
  is_mandatory: boolean | null;
  is_new: boolean | null;
  duration_minutes: number | null;
  thumbnail_url: string | null;
};

type FilterKey = 'all' | 'mandatory' | 'new' | 'category';

export default function OrgLocalCoursesPage() {
  const params = useParams();
  const localId = params?.localId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [draftAssigned, setDraftAssigned] = useState<Set<string>>(new Set());
  const [initialAssigned, setInitialAssigned] = useState<Set<string>>(
    new Set(),
  );
  const [feedback, setFeedback] = useState('');

  const refetchCourses = async () => {
    if (!localId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_org_local_courses')
      .select('*')
      .eq('local_id', localId);

    if (fetchError) {
      setError(fetchError.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const nextRows = (data as CourseRow[]) ?? [];
    setRows(nextRows);
    const active = new Set(
      nextRows.filter((row) => row.is_assigned).map((row) => row.course_id),
    );
    setInitialAssigned(active);
    setDraftAssigned(new Set(active));
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_org_local_courses')
        .select('*')
        .eq('local_id', localId);

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const nextRows = (data as CourseRow[]) ?? [];
      setRows(nextRows);
      const active = new Set(
        nextRows.filter((row) => row.is_assigned).map((row) => row.course_id),
      );
      setInitialAssigned(active);
      setDraftAssigned(new Set(active));
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [localId]);

  const hasCategory = useMemo(() => rows.some((row) => row.category), [rows]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (row.category) set.add(row.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (searchLower && !row.title.toLowerCase().includes(searchLower)) {
        return false;
      }
      if (filter === 'mandatory' && row.is_mandatory !== true) {
        return false;
      }
      if (filter === 'new' && row.is_new !== true) {
        return false;
      }
      if (filter === 'category' && selectedCategory) {
        return row.category === selectedCategory;
      }
      return true;
    });
  }, [rows, search, filter, selectedCategory]);

  const assignedRows = filteredRows
    .filter((row) => draftAssigned.has(row.course_id))
    .sort((a, b) => a.title.localeCompare(b.title));

  const availableRows = filteredRows
    .filter((row) => !draftAssigned.has(row.course_id))
    .sort((a, b) => a.title.localeCompare(b.title));

  const isDirty = useMemo(() => {
    if (draftAssigned.size !== initialAssigned.size) return true;
    for (const id of draftAssigned) {
      if (!initialAssigned.has(id)) return true;
    }
    return false;
  }, [draftAssigned, initialAssigned]);

  const handleToggle = (courseId: string) => {
    if (saving) return;
    setFeedback('');
    setDraftAssigned((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!localId || saving || !isDirty) return;
    setSaving(true);
    setFeedback('');
    setError('');

    const desired = Array.from(draftAssigned);
    const { error: rpcError } = await supabase.rpc('rpc_set_local_courses', {
      p_local_id: localId,
      p_course_ids: desired,
    });

    if (rpcError) {
      setError(rpcError.message);
      setSaving(false);
      return;
    }

    await refetchCourses();
    setSaving(false);
    setFeedback('Cursos asignados correctamente.');
  };

  const emptyAssigned = draftAssigned.size === 0;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-4">
          <nav className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/org/dashboard" className="font-semibold text-zinc-700">
              Dashboard
            </Link>
            <span>/</span>
            <Link
              href={`/org/locals/${localId}`}
              className="font-semibold text-zinc-700"
            >
              Local
            </Link>
            <span>/</span>
            <span>Cursos</span>
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs tracking-wide text-zinc-500 uppercase">
                Asignación de cursos
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
                Cursos por local
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Selecciona qué cursos estarán disponibles en este local.
              </p>
            </div>
            <button
              className="rounded-full bg-zinc-900 px-5 py-2 text-xs font-semibold text-white disabled:opacity-60"
              type="button"
              disabled={!isDirty || saving}
              onClick={handleSave}
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </header>

        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-20 animate-pulse rounded-2xl bg-white"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-white p-6 text-sm text-red-600 shadow-sm">
            Error: {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
            No encontrado o sin acceso.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            {feedback && (
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
                {feedback}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <input
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-900"
                placeholder="Buscar por nombre de curso"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                disabled={saving}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    filter === 'all'
                      ? 'bg-zinc-900 text-white'
                      : 'border border-zinc-200 text-zinc-600'
                  }`}
                  type="button"
                  onClick={() => setFilter('all')}
                  disabled={saving}
                >
                  Todos
                </button>
                {rows.some((row) => row.is_mandatory !== null) && (
                  <button
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      filter === 'mandatory'
                        ? 'bg-zinc-900 text-white'
                        : 'border border-zinc-200 text-zinc-600'
                    }`}
                    type="button"
                    onClick={() => setFilter('mandatory')}
                    disabled={saving}
                  >
                    Obligatorios
                  </button>
                )}
                {rows.some((row) => row.is_new !== null) && (
                  <button
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      filter === 'new'
                        ? 'bg-zinc-900 text-white'
                        : 'border border-zinc-200 text-zinc-600'
                    }`}
                    type="button"
                    onClick={() => setFilter('new')}
                    disabled={saving}
                  >
                    Nuevos
                  </button>
                )}
                {hasCategory && (
                  <button
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      filter === 'category'
                        ? 'bg-zinc-900 text-white'
                        : 'border border-zinc-200 text-zinc-600'
                    }`}
                    type="button"
                    onClick={() => setFilter('category')}
                    disabled={saving}
                  >
                    Categoría
                  </button>
                )}
              </div>
              {filter === 'category' && hasCategory && (
                <select
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-700"
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  disabled={saving}
                >
                  <option value="">Todas</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {emptyAssigned && (
              <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
                Este local todavía no tiene cursos asignados.
              </div>
            )}

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-900">
                Cursos asignados
              </h2>
              {assignedRows.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-5 text-sm text-zinc-500">
                  No hay cursos asignados con los filtros actuales.
                </div>
              )}
              {assignedRows.map((row) => (
                <div
                  key={row.course_id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {row.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {row.duration_minutes
                        ? `${row.duration_minutes} min`
                        : 'Duración no disponible'}
                    </p>
                  </div>
                  <label className="flex items-center gap-3 text-xs font-semibold text-zinc-600">
                    <input
                      type="checkbox"
                      checked={draftAssigned.has(row.course_id)}
                      onChange={() => handleToggle(row.course_id)}
                      disabled={saving}
                    />
                    Asignado
                  </label>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-zinc-900">
                Cursos disponibles
              </h2>
              {availableRows.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-5 text-sm text-zinc-500">
                  No hay cursos disponibles con los filtros actuales.
                </div>
              )}
              {availableRows.map((row) => (
                <div
                  key={row.course_id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {row.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {row.duration_minutes
                        ? `${row.duration_minutes} min`
                        : 'Duración no disponible'}
                    </p>
                  </div>
                  <label className="flex items-center gap-3 text-xs font-semibold text-zinc-600">
                    <input
                      type="checkbox"
                      checked={draftAssigned.has(row.course_id)}
                      onChange={() => handleToggle(row.course_id)}
                      disabled={saving}
                    />
                    Asignar
                  </label>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
