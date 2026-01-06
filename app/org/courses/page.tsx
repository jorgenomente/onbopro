'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type CourseStatus = 'draft' | 'published' | 'archived';

type OrgCourseRow = {
  org_id: string;
  course_id: string;
  title: string;
  status: CourseStatus;
  units_count: number;
  lessons_count: number;
  assigned_locals_count: number;
  learners_assigned_count: number;
  updated_at: string;
  published_at: string | null;
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

export default function OrgCoursesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState<OrgCourseRow[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const fetchCourses = async () => {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_org_courses')
      .select('*');

    if (fetchError) {
      setError(fetchError.message);
      setCourses([]);
      setLoading(false);
      return;
    }

    setCourses((data as OrgCourseRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_org_courses')
        .select('*');

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setCourses([]);
        setLoading(false);
        return;
      }

      setCourses((data as OrgCourseRow[]) ?? []);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-wide text-zinc-500 uppercase">
              Org Admin
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
              Gerenciar Cursos
            </h1>
          </div>
          <div className="h-9 w-9 rounded-full border border-zinc-200 bg-white" />
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
            <button
              className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
              onClick={fetchCourses}
              type="button"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && courses.length === 0 && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              Todavia no hay cursos creados.
            </p>
            <button
              className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
              onClick={() => router.push('/org/courses/new')}
              type="button"
            >
              Crear curso
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
                <button
                  key={course.course_id}
                  type="button"
                  onClick={() =>
                    router.push(`/org/courses/${course.course_id}/outline`)
                  }
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
                    <span
                      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                        course.status,
                      )}`}
                    >
                      {statusLabel(course.status)}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                    <span>{course.units_count} modulos</span>
                    <span>{course.lessons_count} lecciones</span>
                  </div>
                </button>
              ))}
            </section>
          </>
        )}
      </div>

      <Link
        href="/org/courses/new"
        className="fixed right-6 bottom-8 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-xl text-white shadow-lg transition hover:bg-zinc-800"
        aria-label="Crear curso"
      >
        +
      </Link>
    </div>
  );
}
