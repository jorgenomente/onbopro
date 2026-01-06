'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { logout } from '@/lib/auth/logout';
import { supabase } from '@/lib/supabase/client';

type DashboardCourse = {
  local_id: string;
  course_id: string;
  course_title: string;
  course_image_url: string | null;
  course_status: 'pending' | 'in_progress' | 'completed';
  total_lessons: number;
  completed_lessons: number;
  progress_percent: number;
  last_activity_at: string | null;
  completed_at: string | null;
  current_unit_id: string | null;
  current_unit_title: string | null;
  estimated_minutes_left: number | null;
};

export default function LocalDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const localId = params?.localId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState<DashboardCourse[]>([]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const fetchCourses = async () => {
    if (!localId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_learner_dashboard_courses')
      .select('*')
      .eq('local_id', localId);

    if (fetchError) {
      setError(fetchError.message);
      setCourses([]);
      setLoading(false);
      return;
    }

    setCourses((data ?? []) as DashboardCourse[]);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_learner_dashboard_courses')
        .select('*')
        .eq('local_id', localId);

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setCourses([]);
        setLoading(false);
        return;
      }

      setCourses((data ?? []) as DashboardCourse[]);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [localId]);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Cursos asignados a tu local.
            </p>
          </div>
          <button
            className="self-start rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
            onClick={handleLogout}
            type="button"
          >
            Cerrar sesión
          </button>
        </header>

        {loading && (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-36 animate-pulse rounded-2xl bg-white p-5 shadow-sm"
              >
                <div className="h-4 w-2/3 rounded bg-zinc-200" />
                <div className="mt-4 h-3 w-1/2 rounded bg-zinc-200" />
                <div className="mt-6 h-2 w-full rounded bg-zinc-200" />
              </div>
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
              No hay cursos asignados a este local.
            </p>
          </div>
        )}

        {!loading && !error && courses.length > 0 && (
          <section className="mt-8 grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <div
                key={course.course_id}
                className="rounded-2xl bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-wide text-zinc-500 uppercase">
                      {course.course_status}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-zinc-900">
                      {course.course_title}
                    </h2>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    {course.completed_lessons}/{course.total_lessons}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="h-2 w-full rounded-full bg-zinc-100">
                    <div
                      className="h-2 rounded-full bg-zinc-900"
                      style={{ width: `${course.progress_percent}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    {course.progress_percent}% completado
                  </div>
                </div>

                {course.current_unit_title && (
                  <div className="mt-4 text-sm text-zinc-600">
                    Continuar: {course.current_unit_title}
                  </div>
                )}
                <button
                  className="mt-5 inline-flex rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
                  onClick={() =>
                    router.push(`/l/${localId}/courses/${course.course_id}`)
                  }
                  type="button"
                >
                  Ver curso
                </button>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
