'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type LessonType = 'text' | 'html' | 'richtext' | 'video' | 'file' | 'link';

type LessonRow = {
  lesson_id: string;
  title: string;
  lesson_type: LessonType;
  position: number;
  estimated_minutes: number | null;
  is_required: boolean;
};

type QuizSummary = {
  quiz_id: string;
  title: string;
  questions_count: number;
  pass_score_pct: number;
};

type UnitRow = {
  unit_id: string;
  title: string;
  position: number;
  lessons: LessonRow[];
  unit_quiz: QuizSummary | null;
};

type CourseOutlineRow = {
  org_id: string;
  course_id: string;
  course_title: string;
  course_status: 'draft' | 'published' | 'archived';
  units: UnitRow[];
  final_quiz: QuizSummary | null;
};

function statusLabel(status: CourseOutlineRow['course_status']) {
  if (status === 'published') return 'Activo';
  if (status === 'archived') return 'Archivado';
  return 'Borrador';
}

function statusClass(status: CourseOutlineRow['course_status']) {
  if (status === 'published') return 'bg-emerald-100 text-emerald-700';
  if (status === 'archived') return 'bg-zinc-200 text-zinc-700';
  return 'bg-amber-100 text-amber-700';
}

function lessonTypeIcon(type: LessonType) {
  if (type === 'video') return '🎬';
  if (type === 'file') return '📄';
  if (type === 'link') return '🔗';
  if (type === 'html' || type === 'richtext') return '🧩';
  return '📝';
}

export default function OrgCourseOutlinePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [row, setRow] = useState<CourseOutlineRow | null>(null);

  const refetchOutline = async () => {
    if (!courseId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_org_course_outline')
      .select('*')
      .eq('course_id', courseId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setRow(null);
      setLoading(false);
      return;
    }

    setRow((data as CourseOutlineRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!courseId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_org_course_outline')
        .select('*')
        .eq('course_id', courseId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setRow(null);
        setLoading(false);
        return;
      }

      setRow((data as CourseOutlineRow) ?? null);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const units = useMemo(() => row?.units ?? [], [row]);
  const canSave = !loading && !isSaving && !!row;

  const handleCreateUnit = async () => {
    if (!courseId || !canSave) return;
    const title = window.prompt('Titulo de la unidad');
    if (!title?.trim()) return;
    setIsSaving(true);
    setActionError(null);

    const { error: rpcError } = await supabase.rpc('rpc_create_course_unit', {
      p_course_id: courseId,
      p_title: title.trim(),
    });

    if (rpcError) {
      setActionError(rpcError.message);
      setIsSaving(false);
      return;
    }

    await refetchOutline();
    setIsSaving(false);
  };

  const handleReorderUnits = async (newOrder: string[]) => {
    if (!courseId || !canSave) return;
    setIsSaving(true);
    setActionError(null);

    const { error: rpcError } = await supabase.rpc('rpc_reorder_course_units', {
      p_course_id: courseId,
      p_unit_ids: newOrder,
    });

    if (rpcError) {
      setActionError(rpcError.message);
      setIsSaving(false);
      return;
    }

    await refetchOutline();
    setIsSaving(false);
  };

  const handleCreateLesson = async (unitId: string) => {
    if (!canSave) return;
    const title = window.prompt('Titulo de la leccion');
    if (!title?.trim()) return;
    const type = window.prompt(
      'Tipo de leccion (text, html, richtext, video, file, link)',
      'text',
    );
    if (!type) return;
    const lessonType = type.trim();
    setIsSaving(true);
    setActionError(null);

    const { error: rpcError } = await supabase.rpc('rpc_create_unit_lesson', {
      p_unit_id: unitId,
      p_title: title.trim(),
      p_lesson_type: lessonType,
      p_is_required: true,
    });

    if (rpcError) {
      setActionError(rpcError.message);
      setIsSaving(false);
      return;
    }

    await refetchOutline();
    setIsSaving(false);
  };

  const handleReorderLessons = async (unitId: string, newOrder: string[]) => {
    if (!canSave) return;
    setIsSaving(true);
    setActionError(null);

    const { error: rpcError } = await supabase.rpc('rpc_reorder_unit_lessons', {
      p_unit_id: unitId,
      p_lesson_ids: newOrder,
    });

    if (rpcError) {
      setActionError(rpcError.message);
      setIsSaving(false);
      return;
    }

    await refetchOutline();
    setIsSaving(false);
  };

  const handleCreateUnitQuiz = async (unitId: string) => {
    if (!canSave) return;
    setIsSaving(true);
    setActionError(null);

    const { data, error: rpcError } = await supabase.rpc(
      'rpc_create_unit_quiz',
      {
        p_unit_id: unitId,
      },
    );

    if (rpcError) {
      setActionError(rpcError.message);
      setIsSaving(false);
      return;
    }

    if (data) {
      router.push(`/org/courses/${courseId}/quizzes/${data}/edit`);
    } else {
      await refetchOutline();
    }
    setIsSaving(false);
  };

  const handleCreateFinalQuiz = async () => {
    if (!canSave || !courseId) return;
    setIsSaving(true);
    setActionError(null);

    const { data, error: rpcError } = await supabase.rpc(
      'rpc_create_final_quiz',
      {
        p_course_id: courseId,
      },
    );

    if (rpcError) {
      setActionError(rpcError.message);
      setIsSaving(false);
      return;
    }

    if (data) {
      router.push(`/org/courses/${courseId}/quizzes/${data}/edit`);
    } else {
      await refetchOutline();
    }
    setIsSaving(false);
  };

  const handleEditLesson = (lessonId: string) => {
    if (!courseId) return;
    router.push(`/org/courses/${courseId}/lessons/${lessonId}/edit`);
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="space-y-4">
          <nav className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/org/courses" className="font-semibold text-zinc-700">
              Cursos
            </Link>
            <span>/</span>
            <span>{row?.course_title ?? 'Outline'}</span>
          </nav>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs tracking-wide text-zinc-500 uppercase">
                  Estructura del curso
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
                  {row?.course_title ?? 'Curso'}
                </h1>
                {row && (
                  <span
                    className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                      row.course_status,
                    )}`}
                  >
                    {statusLabel(row.course_status)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/org/courses/${courseId}/preview`}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                >
                  Preview
                </Link>
                <Link
                  href={`/org/courses/${courseId}/edit`}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  Editar curso
                </Link>
              </div>
            </div>
          </div>
        </header>

        {loading && (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
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
            <Link
              href="/org/courses"
              className="mt-4 inline-flex rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Volver
            </Link>
          </div>
        )}

        {!loading && !error && !row && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              No tenés acceso a este curso o no existe.
            </p>
            <Link
              href="/org/courses"
              className="mt-4 inline-flex rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
            >
              Volver
            </Link>
          </div>
        )}

        {!loading && !error && row && (
          <>
            {actionError && (
              <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                {actionError}
              </div>
            )}
            <section className="mt-8 space-y-4">
              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
                  type="button"
                  disabled={!canSave}
                  onClick={handleCreateUnit}
                >
                  + Agregar unidad
                </button>
                <button
                  className="rounded-xl border border-dashed border-zinc-300 bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-500"
                  type="button"
                  disabled
                  title="Próximamente"
                >
                  + Agregar quiz
                </button>
              </div>

              {units.length === 0 && (
                <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
                  Este curso todavia no tiene unidades.
                </div>
              )}

              {units.map((unit, unitIndex) => (
                <div
                  key={unit.unit_id}
                  className="rounded-2xl bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-600">
                          Unidad {unit.position}
                        </span>
                        <span className="text-zinc-400">⋮⋮</span>
                      </div>
                      <h2 className="mt-2 text-lg font-semibold text-zinc-900">
                        {unit.title}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300 disabled:cursor-not-allowed disabled:bg-zinc-100"
                        type="button"
                        disabled={!canSave || unitIndex === 0}
                        onClick={() => {
                          const order = units.map((item) => item.unit_id);
                          const next = [...order];
                          [next[unitIndex - 1], next[unitIndex]] = [
                            next[unitIndex],
                            next[unitIndex - 1],
                          ];
                          void handleReorderUnits(next);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300 disabled:cursor-not-allowed disabled:bg-zinc-100"
                        type="button"
                        disabled={!canSave || unitIndex === units.length - 1}
                        onClick={() => {
                          const order = units.map((item) => item.unit_id);
                          const next = [...order];
                          [next[unitIndex], next[unitIndex + 1]] = [
                            next[unitIndex + 1],
                            next[unitIndex],
                          ];
                          void handleReorderUnits(next);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300 disabled:cursor-not-allowed disabled:bg-zinc-100"
                        type="button"
                        disabled={!canSave}
                        onClick={() => void handleCreateLesson(unit.unit_id)}
                      >
                        + Lección
                      </button>
                      {unit.unit_quiz && (
                        <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
                          <div>
                            <p className="font-semibold text-zinc-700">
                              Quiz de la unidad
                            </p>
                            <p className="mt-1 text-[11px] text-zinc-500">
                              {unit.unit_quiz.questions_count} preguntas ·{' '}
                              {unit.unit_quiz.pass_score_pct}% aprobación
                            </p>
                          </div>
                          <Link
                            className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300"
                            href={`/org/courses/${courseId}/quizzes/${unit.unit_quiz.quiz_id}/edit`}
                          >
                            Editar quiz
                          </Link>
                        </div>
                      )}
                      {!unit.unit_quiz && (
                        <button
                          className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold text-zinc-600 hover:border-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-400"
                          type="button"
                          disabled={!canSave}
                          onClick={() =>
                            void handleCreateUnitQuiz(unit.unit_id)
                          }
                        >
                          + Crear quiz
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {unit.lessons.length === 0 && (
                      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500">
                        Sin lecciones en esta unidad.
                      </div>
                    )}
                    {unit.lessons.map((lesson, lessonIndex) => (
                      <button
                        key={lesson.lesson_id}
                        type="button"
                        onClick={() => handleEditLesson(lesson.lesson_id)}
                        className="flex w-full flex-col gap-2 rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-left text-sm text-zinc-700 transition hover:border-zinc-200 hover:bg-zinc-100 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">
                            {lessonTypeIcon(lesson.lesson_type)}
                          </span>
                          <div>
                            <p className="font-semibold text-zinc-900">
                              {lesson.title}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              Lección {lesson.position}
                              {lesson.estimated_minutes
                                ? ` · ${lesson.estimated_minutes} min`
                                : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <button
                            className="rounded-full border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300 disabled:cursor-not-allowed disabled:bg-zinc-100"
                            type="button"
                            disabled={!canSave || lessonIndex === 0}
                            onClick={(event) => {
                              event.stopPropagation();
                              const order = unit.lessons.map(
                                (item) => item.lesson_id,
                              );
                              const next = [...order];
                              [next[lessonIndex - 1], next[lessonIndex]] = [
                                next[lessonIndex],
                                next[lessonIndex - 1],
                              ];
                              void handleReorderLessons(unit.unit_id, next);
                            }}
                          >
                            ↑
                          </button>
                          <button
                            className="rounded-full border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300 disabled:cursor-not-allowed disabled:bg-zinc-100"
                            type="button"
                            disabled={
                              !canSave ||
                              lessonIndex === unit.lessons.length - 1
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              const order = unit.lessons.map(
                                (item) => item.lesson_id,
                              );
                              const next = [...order];
                              [next[lessonIndex], next[lessonIndex + 1]] = [
                                next[lessonIndex + 1],
                                next[lessonIndex],
                              ];
                              void handleReorderLessons(unit.unit_id, next);
                            }}
                          >
                            ↓
                          </button>
                          {lesson.is_required && (
                            <span className="rounded-full bg-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                              Obligatoria
                            </span>
                          )}
                          <button
                            className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEditLesson(lesson.lesson_id);
                            }}
                          >
                            Editar
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {row.final_quiz && (
              <section className="mt-8 rounded-2xl border border-dashed border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Evaluación final
                </h3>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-zinc-600">
                      {row.final_quiz.title}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {row.final_quiz.questions_count} preguntas ·{' '}
                      {row.final_quiz.pass_score_pct}% aprobación
                    </p>
                  </div>
                  <Link
                    className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-600 hover:border-zinc-300"
                    href={`/org/courses/${courseId}/quizzes/${row.final_quiz.quiz_id}/edit`}
                  >
                    Editar quiz
                  </Link>
                </div>
              </section>
            )}
            {!row.final_quiz && (
              <section className="mt-8 rounded-2xl border border-dashed border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
                <button
                  className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:border-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-400"
                  type="button"
                  disabled={!canSave}
                  onClick={() => void handleCreateFinalQuiz()}
                >
                  + Crear evaluación final
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
