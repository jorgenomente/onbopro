# Auditoria UI Aprendiz (Lote 1) — Player Refresh

Este documento recopila el estado real de la UI Aprendiz: rutas, archivos fuente, imports, data fetching, estados UI y flujo de navegacion. Incluye el contenido completo de los archivos de pagina para referencia.

## Tabla de rutas → archivos

| Ruta                            | Archivo                                     |
| ------------------------------- | ------------------------------------------- |
| /l/[localId]/dashboard          | app/l/[localId]/dashboard/page.tsx          |
| /l/[localId]/courses/[courseId] | app/l/[localId]/courses/[courseId]/page.tsx |
| /l/[localId]/lessons/[lessonId] | app/l/[localId]/lessons/[lessonId]/page.tsx |
| /l/[localId]/quizzes/[quizId]   | app/l/[localId]/quizzes/[quizId]/page.tsx   |

## Pagina: Dashboard Aprendiz

**Archivo**: `app/l/[localId]/dashboard/page.tsx`

**Imports relevantes**:

- `useEffect`, `useState` (react)
- `useParams`, `useRouter` (next/navigation)
- `logout` (`lib/auth/logout`)
- `supabase` (`lib/supabase/client`)

**Data fetching**:

- Vista: `public.v_learner_dashboard_courses`
- Filtros: `local_id = params.localId`
- Metodo: `.select('*')` (array)
- Patrones: `useEffect` async inline + `cancelled`, helper `fetchCourses` para retry

**UI y estados**:

- Header con titulo “Dashboard”, subtitulo y boton “Cerrar sesion”.
- Loading: skeleton cards (4).
- Error: panel con mensaje y boton “Reintentar” (usa `fetchCourses`).
- Empty: “No hay cursos asignados a este local.”
- Data: grid de cards por curso con status, progreso, unidad actual.
- CTA por card: “Ver curso” → `/l/${localId}/courses/${course_id}`.
- Progreso con barra y porcentaje.

**Contenido completo**:

```tsx
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
            Cerrar sesion
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
```

## Pagina: Course Outline Aprendiz

**Archivo**: `app/l/[localId]/courses/[courseId]/page.tsx`

**Imports relevantes**:

- `useEffect`, `useMemo`, `useState`
- `useParams`, `useRouter`
- `supabase`

**Data fetching**:

- Vista: `public.v_course_outline`
- Filtros: `local_id`, `course_id`
- Orden: `unit_position asc`, `lesson_position asc`
- Metodo: `.select('*')` (array)
- `useEffect` async inline + `cancelled`
- helper `fetchOutline` para retry

**UI y estados**:

- Header con titulo de curso, progreso y CTA “Continuar”.
- Loading: skeleton blocks.
- Error: panel con retry.
- Empty: “curso no disponible o sin contenido”.
- Unidades agrupadas (useMemo) con lecciones.
- Cada leccion es boton → `/l/${localId}/lessons/${lesson_id}`.
- CTA de unit quiz si `unit_quiz_id`.
- CTA de quiz final si `course_quiz_id`.

**Contenido completo**:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type OutlineRow = {
  local_id: string;
  course_id: string;
  course_title: string;
  course_image_url: string | null;
  total_units: number;
  total_lessons: number;
  completed_lessons: number;
  progress_percent: number;
  unit_id: string;
  unit_title: string;
  unit_position: number;
  unit_total_lessons: number;
  unit_completed_lessons: number;
  unit_progress_percent: number;
  unit_status: 'pending' | 'in_progress' | 'completed';
  unit_quiz_id: string | null;
  course_quiz_id: string | null;
  lesson_id: string;
  lesson_title: string;
  lesson_position: number;
  lesson_duration_minutes: number | null;
  lesson_status: 'completed' | 'in_progress' | 'pending';
  lesson_completed_at: string | null;
};

type UnitGroup = {
  unit_id: string;
  unit_title: string;
  unit_position: number;
  unit_status: OutlineRow['unit_status'];
  unit_progress_percent: number;
  unit_completed_lessons: number;
  unit_total_lessons: number;
  unit_quiz_id: string | null;
  lessons: OutlineRow[];
};

export default function CourseOutlinePage() {
  const router = useRouter();
  const params = useParams();
  const localId = params?.localId as string;
  const courseId = params?.courseId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<OutlineRow[]>([]);

  const fetchOutline = async () => {
    if (!localId || !courseId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_course_outline')
      .select('*')
      .eq('local_id', localId)
      .eq('course_id', courseId)
      .order('unit_position', { ascending: true })
      .order('lesson_position', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as OutlineRow[]);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localId || !courseId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_course_outline')
        .select('*')
        .eq('local_id', localId)
        .eq('course_id', courseId)
        .order('unit_position', { ascending: true })
        .order('lesson_position', { ascending: true });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as OutlineRow[]);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [courseId, localId]);

  const groupedUnits = useMemo<UnitGroup[]>(() => {
    const map = new Map<string, UnitGroup>();
    rows.forEach((row) => {
      if (!map.has(row.unit_id)) {
        map.set(row.unit_id, {
          unit_id: row.unit_id,
          unit_title: row.unit_title,
          unit_position: row.unit_position,
          unit_status: row.unit_status,
          unit_progress_percent: row.unit_progress_percent,
          unit_completed_lessons: row.unit_completed_lessons,
          unit_total_lessons: row.unit_total_lessons,
          unit_quiz_id: row.unit_quiz_id,
          lessons: [],
        });
      }
      map.get(row.unit_id)?.lessons.push(row);
    });

    return Array.from(map.values()).sort(
      (a, b) => a.unit_position - b.unit_position,
    );
  }, [rows]);

  const courseTitle = rows[0]?.course_title ?? 'Curso';
  const progressPercent = rows[0]?.progress_percent ?? 0;
  const completedLessons = rows[0]?.completed_lessons ?? 0;
  const totalLessons = rows[0]?.total_lessons ?? 0;
  const courseQuizId = rows[0]?.course_quiz_id ?? null;

  const nextLessonId = useMemo(() => {
    const inProgress = rows.find((row) => row.lesson_status === 'in_progress');
    return (inProgress ?? rows[0])?.lesson_id;
  }, [rows]);

  const handleContinue = () => {
    if (!nextLessonId) return;
    router.push(`/l/${localId}/lessons/${nextLessonId}`);
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-col gap-4">
          <div>
            <p className="text-xs tracking-wide text-zinc-500 uppercase">
              Curso
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
              {courseTitle}
            </h1>
          </div>

          {!loading && rows.length > 0 && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Progreso</span>
                <span className="text-sm font-semibold text-zinc-900">
                  {progressPercent}%
                </span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-zinc-100">
                <div
                  className="h-2 rounded-full bg-zinc-900"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {completedLessons}/{totalLessons} lecciones completadas
              </p>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <button
              className="w-full rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              type="button"
              onClick={handleContinue}
              disabled={!nextLessonId}
            >
              Continuar
            </button>
          )}
        </header>

        {loading && (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-24 animate-pulse rounded-2xl bg-white p-5"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
            <button
              className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
              onClick={fetchOutline}
              type="button"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              Este curso no esta disponible o no tiene contenido.
            </p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="mt-8 space-y-6">
            {groupedUnits.map((unit) => (
              <div
                key={unit.unit_id}
                className="rounded-2xl bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs tracking-wide text-zinc-500 uppercase">
                      Unidad {unit.unit_position}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-zinc-900">
                      {unit.unit_title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3 text-right text-xs text-zinc-500">
                    {unit.unit_quiz_id && (
                      <button
                        className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                        type="button"
                        onClick={() =>
                          router.push(
                            `/l/${localId}/quizzes/${unit.unit_quiz_id}`,
                          )
                        }
                      >
                        Hacer evaluacion
                      </button>
                    )}
                    <span>{unit.unit_progress_percent}%</span>
                  </div>
                </div>

                <ul className="mt-4 space-y-3">
                  {unit.lessons.map((lesson) => (
                    <li key={lesson.lesson_id}>
                      <button
                        className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-left text-sm text-zinc-700 hover:border-zinc-300"
                        onClick={() =>
                          router.push(
                            `/l/${localId}/lessons/${lesson.lesson_id}`,
                          )
                        }
                        type="button"
                      >
                        <span>{lesson.lesson_title}</span>
                        <span className="text-xs tracking-wide text-zinc-500 uppercase">
                          {lesson.lesson_status}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {courseQuizId && (
              <button
                className="w-full rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-800 hover:border-zinc-300"
                type="button"
                onClick={() =>
                  router.push(`/l/${localId}/quizzes/${courseQuizId}`)
                }
              >
                Evaluacion final del curso
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

## Pagina: Lesson Player Aprendiz

**Archivo**: `app/l/[localId]/lessons/[lessonId]/page.tsx`

**Imports relevantes**:

- `useEffect`, `useMemo`, `useState`
- `useParams`, `useRouter`
- `supabase`

**Data fetching**:

- Vista: `public.v_lesson_player`
- Filtros: `local_id`, `lesson_id`
- Metodo: `.maybeSingle()`
- `useEffect` async inline + `cancelled`
- helper `fetchLesson` para retry/refetch post RPC

**UI y estados**:

- Loading: skeleton blocks.
- Error: panel con retry.
- Empty: “No tenes acceso a esta leccion”.
- Header con curso/unidad/titulo + badge estado.
- Render de contenido segun `content_type`.
- CTA “Marcar como completada” → `rpc_mark_lesson_completed`.
- Footer con “Volver al curso”, “Anterior”, “Siguiente”.

**Contenido completo**:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type LessonRow = {
  local_id: string;
  course_id: string;
  course_title: string;
  course_image_url: string | null;
  unit_id: string;
  unit_title: string;
  unit_position: number;
  lesson_id: string;
  lesson_title: string;
  lesson_position: number;
  content_type: string;
  content: Record<string, unknown> | null;
  is_completed: boolean;
  completed_at: string | null;
  can_mark_complete: boolean;
  prev_lesson_id: string | null;
  next_lesson_id: string | null;
};

export default function LessonPlaceholderPage() {
  const router = useRouter();
  const params = useParams();
  const localId = params?.localId as string;
  const lessonId = params?.lessonId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState('');
  const [markSuccess, setMarkSuccess] = useState('');

  const fetchLesson = async () => {
    if (!localId || !lessonId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_lesson_player')
      .select('*')
      .eq('local_id', localId)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setLesson(null);
      setLoading(false);
      return;
    }

    setLesson((data as LessonRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localId || !lessonId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_lesson_player')
        .select('*')
        .eq('local_id', localId)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setLesson(null);
        setLoading(false);
        return;
      }

      setLesson((data as LessonRow) ?? null);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [lessonId, localId]);

  const statusLabel = useMemo(() => {
    if (!lesson) return '';
    return lesson.is_completed ? 'Completada' : 'Pendiente';
  }, [lesson]);

  const renderContent = () => {
    if (!lesson) return null;
    const content = lesson.content ?? {};

    if (lesson.content_type === 'video' && typeof content.url === 'string') {
      return (
        <video className="w-full rounded-2xl" controls>
          <source src={content.url} />
        </video>
      );
    }

    if (lesson.content_type === 'html' && typeof content.html === 'string') {
      return (
        <div
          className="prose max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: content.html }}
        />
      );
    }

    if (lesson.content_type === 'text' && typeof content.text === 'string') {
      return <p className="text-sm text-zinc-700">{content.text}</p>;
    }

    if (typeof content.url === 'string') {
      return (
        <a className="text-sm text-zinc-900 underline" href={content.url}>
          Abrir contenido
        </a>
      );
    }

    return (
      <pre className="rounded-2xl bg-zinc-100 p-4 text-xs text-zinc-600">
        {JSON.stringify(content, null, 2)}
      </pre>
    );
  };

  const handleBack = () => {
    if (lesson?.course_id) {
      router.push(`/l/${localId}/courses/${lesson.course_id}`);
      return;
    }
    router.back();
  };

  const handlePrev = () => {
    if (!lesson?.prev_lesson_id) return;
    router.push(`/l/${localId}/lessons/${lesson.prev_lesson_id}`);
  };

  const handleNext = () => {
    if (!lesson?.next_lesson_id) return;
    router.push(`/l/${localId}/lessons/${lesson.next_lesson_id}`);
  };

  const handleMarkComplete = async () => {
    if (!lesson) return;
    setMarkError('');
    setMarkSuccess('');
    setMarking(true);

    const { error: rpcError } = await supabase.rpc(
      'rpc_mark_lesson_completed',
      {
        p_local_id: lesson.local_id,
        p_lesson_id: lesson.lesson_id,
      },
    );

    setMarking(false);

    if (rpcError) {
      setMarkError(rpcError.message);
      return;
    }

    setMarkSuccess('Leccion marcada como completada.');
    await fetchLesson();
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        {loading && (
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded-2xl bg-white" />
            <div className="h-48 animate-pulse rounded-2xl bg-white" />
            <div className="h-24 animate-pulse rounded-2xl bg-white" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
            <button
              className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
              onClick={fetchLesson}
              type="button"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && !lesson && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              No tenes acceso a esta leccion o no existe.
            </p>
          </div>
        )}

        {!loading && !error && lesson && (
          <div className="space-y-6">
            <header className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs tracking-wide text-zinc-500 uppercase">
                    {lesson.course_title} · {lesson.unit_title}
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
                    {lesson.lesson_title}
                  </h1>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                  {statusLabel}
                </span>
              </div>
            </header>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              {renderContent()}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-zinc-600">
                  {lesson.is_completed
                    ? 'Leccion completada.'
                    : 'Marca esta leccion como completada.'}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    type="button"
                    onClick={handleMarkComplete}
                    disabled={!lesson.can_mark_complete || marking}
                  >
                    {marking ? 'Guardando...' : 'Marcar como completada'}
                  </button>
                  {markError ? (
                    <span className="text-xs text-red-600">{markError}</span>
                  ) : null}
                  {markSuccess ? (
                    <span className="text-xs text-emerald-600">
                      {markSuccess}
                    </span>
                  ) : null}
                </div>
              </div>
            </section>

            <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
                onClick={handleBack}
                type="button"
              >
                Volver al curso
              </button>
              <div className="flex gap-2">
                <button
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300 disabled:opacity-50"
                  onClick={handlePrev}
                  type="button"
                  disabled={!lesson.prev_lesson_id}
                >
                  Anterior
                </button>
                <button
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300 disabled:opacity-50"
                  onClick={handleNext}
                  type="button"
                  disabled={!lesson.next_lesson_id}
                >
                  Siguiente
                </button>
              </div>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
```

## Pagina: Quiz Player Aprendiz

**Archivo**: `app/l/[localId]/quizzes/[quizId]/page.tsx`

**Imports relevantes**:

- `useEffect`, `useMemo`, `useState`
- `useParams`, `useRouter`
- `supabase`

**Data fetching**:

- Vista: `public.v_quiz_state`
- Filtros: `local_id`, `quiz_id`
- Metodo: `.maybeSingle()`
- `useEffect` async inline + `cancelled`
- helper `fetchQuiz` para refetch

**UI y estados**:

- Loading: skeleton blocks.
- Error: panel con retry.
- Empty: “No tenes acceso a este quiz”.
- Header con scope, titulo, responded count, score si submitted.
- Questions con options (radio) y text area.
- RPCs: `rpc_quiz_start`, `rpc_quiz_answer`, `rpc_quiz_submit`.
- Footer: “Volver al curso”, “Comenzar”, “Enviar”.

**Contenido completo**:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type QuizQuestionOption = {
  option_id: string;
  position: number;
  option_text: string;
};

type QuizQuestion = {
  question_id: string;
  position: number;
  prompt: string;
  options: QuizQuestionOption[] | null;
  selected_option_id: string | null;
  answer_text: string | null;
};

type QuizStateRow = {
  local_id: string;
  quiz_id: string;
  quiz_title: string;
  quiz_type: string;
  course_id: string;
  unit_id: string | null;
  quiz_scope: 'unit' | 'course';
  total_questions: number;
  time_limit_minutes: number | null;
  pass_percent: number | null;
  attempt_id: string | null;
  attempt_no: number | null;
  attempt_status: 'not_started' | 'in_progress' | 'submitted';
  started_at: string | null;
  submitted_at: string | null;
  answered_count: number;
  current_question_index: number | null;
  current_question_id: string | null;
  questions: QuizQuestion[] | null;
  score: number | null;
  passed: boolean | null;
};

export default function QuizPlayerPage() {
  const router = useRouter();
  const params = useParams();
  const localId = params?.localId as string;
  const quizId = params?.quizId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quiz, setQuiz] = useState<QuizStateRow | null>(null);
  const [actionError, setActionError] = useState('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);

  const fetchQuiz = async () => {
    if (!localId || !quizId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_quiz_state')
      .select('*')
      .eq('local_id', localId)
      .eq('quiz_id', quizId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setQuiz(null);
      setLoading(false);
      return;
    }

    setQuiz((data as QuizStateRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localId || !quizId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_quiz_state')
        .select('*')
        .eq('local_id', localId)
        .eq('quiz_id', quizId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setQuiz(null);
        setLoading(false);
        return;
      }

      setQuiz((data as QuizStateRow) ?? null);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [localId, quizId]);

  const normalizedQuestions = useMemo<QuizQuestion[]>(() => {
    const list = quiz?.questions ?? [];
    return [...list]
      .sort((a, b) => a.position - b.position)
      .map((q) => ({
        ...q,
        options: q.options
          ? [...q.options].sort((a, b) => a.position - b.position)
          : null,
      }));
  }, [quiz]);

  const statusLabel = useMemo(() => {
    if (!quiz) return '';
    if (quiz.attempt_status === 'not_started') return 'No iniciado';
    if (quiz.attempt_status === 'in_progress') return 'En progreso';
    return 'Enviado';
  }, [quiz]);

  const handleBack = () => {
    if (quiz?.course_id) {
      router.push(`/l/${localId}/courses/${quiz.course_id}`);
      return;
    }
    router.back();
  };

  const canStart = quiz?.attempt_status === 'not_started';
  const canSubmit = quiz?.attempt_status === 'in_progress';
  const canAnswer =
    quiz?.attempt_status === 'in_progress' && Boolean(quiz?.attempt_id);

  const handleStart = async () => {
    if (!localId || !quizId) return;
    setActionError('');
    setStarting(true);
    const { error: rpcError } = await supabase.rpc('rpc_quiz_start', {
      p_local_id: localId,
      p_quiz_id: quizId,
    });
    setStarting(false);
    if (rpcError) {
      setActionError(rpcError.message);
      return;
    }
    await fetchQuiz();
  };

  const handleAnswer = async (
    questionId: string,
    optionId: string | null,
    answerText: string | null,
  ) => {
    if (!quiz?.attempt_id) return;
    setActionError('');
    setAnsweringId(questionId);
    const { error: rpcError } = await supabase.rpc('rpc_quiz_answer', {
      p_attempt_id: quiz.attempt_id,
      p_question_id: questionId,
      p_option_id: optionId,
      p_answer_text: answerText,
    });
    setAnsweringId(null);
    if (rpcError) {
      setActionError(rpcError.message);
      return;
    }
    await fetchQuiz();
  };

  const handleSubmit = async () => {
    if (!quiz?.attempt_id) return;
    setActionError('');
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc('rpc_quiz_submit', {
      p_attempt_id: quiz.attempt_id,
    });
    setSubmitting(false);
    if (rpcError) {
      setActionError(rpcError.message);
      return;
    }
    await fetchQuiz();
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        {loading && (
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded-2xl bg-white" />
            <div className="h-48 animate-pulse rounded-2xl bg-white" />
            <div className="h-24 animate-pulse rounded-2xl bg-white" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
            <button
              className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
              onClick={fetchQuiz}
              type="button"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && !quiz && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              No tenes acceso a este quiz o no existe.
            </p>
          </div>
        )}

        {!loading && !error && quiz && (
          <div className="space-y-6">
            <header className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs tracking-wide text-zinc-500 uppercase">
                    {quiz.quiz_scope === 'unit'
                      ? 'Quiz de unidad'
                      : 'Quiz final'}
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
                    {quiz.quiz_title}
                  </h1>
                  <p className="mt-1 text-sm text-zinc-500">
                    {quiz.answered_count}/{quiz.total_questions} respondidas
                  </p>
                  {quiz.attempt_status === 'submitted' && (
                    <p className="mt-2 text-sm text-zinc-700">
                      Resultado: {quiz.score ?? 0}% ·{' '}
                      {quiz.passed ? 'Aprobado' : 'No aprobado'}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                  {statusLabel}
                </span>
              </div>
            </header>

            <section className="space-y-4">
              {normalizedQuestions.length === 0 ? (
                <div className="rounded-2xl bg-white p-6 shadow-sm">
                  <p className="text-sm text-zinc-600">
                    Este quiz no tiene preguntas cargadas.
                  </p>
                </div>
              ) : (
                normalizedQuestions.map((question) => (
                  <div
                    key={question.question_id}
                    className="rounded-2xl bg-white p-6 shadow-sm"
                  >
                    <div className="text-sm text-zinc-500">
                      Pregunta {question.position}
                    </div>
                    <h2 className="mt-2 text-base font-semibold text-zinc-900">
                      {question.prompt}
                    </h2>

                    <div className="mt-4 space-y-2">
                      {(question.options ?? []).map((option) => (
                        <label
                          key={option.option_id}
                          className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-700"
                        >
                          <input
                            type="radio"
                            checked={
                              question.selected_option_id === option.option_id
                            }
                            onChange={() =>
                              handleAnswer(
                                question.question_id,
                                option.option_id,
                                null,
                              )
                            }
                            disabled={
                              !canAnswer || answeringId === question.question_id
                            }
                          />
                          <span>{option.option_text}</span>
                        </label>
                      ))}
                      {!question.options && (
                        <div className="rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-700">
                          <textarea
                            className="w-full resize-none bg-transparent text-sm text-zinc-700 outline-none"
                            rows={3}
                            placeholder="Escribe tu respuesta..."
                            defaultValue={question.answer_text ?? ''}
                            disabled={
                              !canAnswer || answeringId === question.question_id
                            }
                            onBlur={(event) =>
                              handleAnswer(
                                question.question_id,
                                null,
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                    {answeringId === question.question_id && (
                      <p className="mt-2 text-xs text-zinc-500">Guardando...</p>
                    )}
                  </div>
                ))
              )}
            </section>

            <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
                onClick={handleBack}
                type="button"
              >
                Volver al curso
              </button>
              <div className="flex gap-2">
                <button
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  type="button"
                  disabled={!canStart || starting}
                  onClick={handleStart}
                >
                  {starting ? 'Iniciando...' : 'Comenzar'}
                </button>
                <button
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 disabled:opacity-50"
                  type="button"
                  disabled={!canSubmit || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </footer>
            {actionError && (
              <div className="rounded-2xl bg-white p-4 text-sm text-red-600 shadow-sm">
                {actionError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

## UI Flow Map (Lote 1 Aprendiz)

```md
Dashboard

- CTA: “Ver curso” → /l/[localId]/courses/[courseId]
- CTA: “Cerrar sesion” → /login

Course Outline

- CTA: “Continuar” → /l/[localId]/lessons/[lessonId] (in_progress o primera)
- Leccion (row) → /l/[localId]/lessons/[lessonId]
- Unit Quiz → /l/[localId]/quizzes/[quizId]
- Final Quiz → /l/[localId]/quizzes/[quizId]

Lesson Player

- CTA: “Volver al curso” → /l/[localId]/courses/[courseId]
- CTA: “Anterior / Siguiente” → /l/[localId]/lessons/[lessonId]
- CTA: “Marcar como completada” → RPC rpc_mark_lesson_completed

Quiz Player

- CTA: “Volver al curso” → /l/[localId]/courses/[courseId]
- CTA: “Comenzar” → RPC rpc_quiz_start
- CTA: “Enviar” → RPC rpc_quiz_submit
```
