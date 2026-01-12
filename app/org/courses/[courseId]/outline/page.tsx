'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type LessonType =
  | 'text'
  | 'html'
  | 'richtext'
  | 'video'
  | 'video_url'
  | 'file'
  | 'link';

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

type OrganizationOption = {
  org_id: string;
  name: string;
  status: 'active' | 'archived';
  admin_email: string | null;
};

type CourseOutlineRow = {
  org_id: string;
  course_id: string;
  course_title: string;
  course_status: 'draft' | 'published' | 'archived';
  units: UnitRow[];
  final_quiz: QuizSummary | null;
  organizations?: OrganizationOption[];
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
  if (type === 'video' || type === 'video_url') return '🎬';
  if (type === 'file') return '📄';
  if (type === 'link') return '🔗';
  if (type === 'html' || type === 'richtext') return '🧩';
  return '📝';
}

function lessonTypeLabel(type: LessonType) {
  if (type === 'text') return 'Texto';
  if (type === 'html') return 'HTML';
  if (type === 'richtext') return 'Rich text';
  if (type === 'video' || type === 'video_url') return 'Video';
  if (type === 'file') return 'Archivo';
  return 'Enlace';
}

export default function OrgCourseOutlinePage() {
  const params = useParams();
  const courseId = params?.courseId as string;

  if (!courseId) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Curso no encontrado.
          </div>
        </div>
      </div>
    );
  }

  return <OrgCourseOutlineScreen courseId={courseId} basePath="/org/courses" />;
}

type CourseOutlineScreenProps = {
  courseId: string;
  basePath: string;
  backHref?: string;
  outlineView?: string;
  rpcConfig?: OutlineRpcConfig;
  extraActions?: ReactNode | ((row: CourseOutlineRow | null) => ReactNode);
  showPreview?: boolean;
};

type OutlineRpcConfig = {
  createUnit: string;
  reorderUnits: string;
  createLesson: string;
  reorderLessons: string;
  createUnitQuiz: string;
  createFinalQuiz: string;
  courseParamKey?: 'p_course_id' | 'p_template_id';
  defaultLessonType?: LessonType;
  allowedLessonTypes?: readonly LessonType[];
};

const DEFAULT_OUTLINE_RPC: OutlineRpcConfig = {
  createUnit: 'rpc_create_course_unit',
  reorderUnits: 'rpc_reorder_course_units',
  createLesson: 'rpc_create_unit_lesson',
  reorderLessons: 'rpc_reorder_unit_lessons',
  createUnitQuiz: 'rpc_create_unit_quiz',
  createFinalQuiz: 'rpc_create_final_quiz',
  courseParamKey: 'p_course_id',
  defaultLessonType: 'text',
  allowedLessonTypes: ['text', 'video_url', 'file', 'link'],
};

export function OrgCourseOutlineScreen({
  courseId,
  basePath,
  backHref,
  outlineView,
  rpcConfig,
  extraActions,
  showPreview = true,
}: CourseOutlineScreenProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [row, setRow] = useState<CourseOutlineRow | null>(null);
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [lessonModalUnitId, setLessonModalUnitId] = useState<string | null>(
    null,
  );
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonType, setLessonType] = useState<LessonType>('text');
  const [lessonModalError, setLessonModalError] = useState('');
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitTitle, setUnitTitle] = useState('');
  const [unitModalError, setUnitModalError] = useState('');
  const viewName = outlineView ?? 'v_org_course_outline';
  const rpcNames = rpcConfig ?? DEFAULT_OUTLINE_RPC;
  const courseParamKey = rpcNames.courseParamKey ?? 'p_course_id';
  const allowedLessonTypes =
    rpcNames.allowedLessonTypes ??
    (rpcNames.defaultLessonType ? [rpcNames.defaultLessonType] : ['text']);
  const buildCourseArgs = (value: string) =>
    ({ [courseParamKey]: value }) as Record<string, string>;

  const refetchOutline = async () => {
    if (!courseId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from(viewName)
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
        .from(viewName)
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
  }, [courseId, viewName]);

  const units = useMemo(() => row?.units ?? [], [row]);
  const canSave = !loading && !isSaving && !!row;
  const courseBase = `${basePath}/${courseId}`;
  const backLink = backHref ?? basePath;
  const isTemplate = basePath.startsWith('/superadmin/course-library');
  const backLabel = isTemplate ? 'Templates' : 'Cursos';
  const resolvedExtraActions =
    typeof extraActions === 'function' ? extraActions(row) : extraActions;

  const openUnitModal = () => {
    if (!canSave) return;
    setUnitTitle('');
    setUnitModalError('');
    setUnitModalOpen(true);
  };

  const handleCreateUnit = async () => {
    if (!courseId || !canSave) return;
    const trimmedTitle = unitTitle.trim();
    if (!trimmedTitle) {
      setUnitModalError('Ingresá un título para la unidad.');
      return;
    }
    setIsSaving(true);
    setActionError(null);
    setUnitModalError('');

    const { error: rpcError } = await supabase.rpc(rpcNames.createUnit, {
      ...buildCourseArgs(courseId),
      p_title: trimmedTitle,
    });

    if (rpcError) {
      setUnitModalError(rpcError.message);
      setIsSaving(false);
      return;
    }

    await refetchOutline();
    setUnitModalOpen(false);
    setIsSaving(false);
  };

  const handleReorderUnits = async (newOrder: string[]) => {
    if (!courseId || !canSave) return;
    setIsSaving(true);
    setActionError(null);

    const { error: rpcError } = await supabase.rpc(rpcNames.reorderUnits, {
      ...buildCourseArgs(courseId),
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

  const openLessonModal = (unitId: string) => {
    if (!canSave) return;
    setLessonModalUnitId(unitId);
    setLessonTitle('');
    setLessonType(
      rpcNames.defaultLessonType ?? allowedLessonTypes[0] ?? 'text',
    );
    setLessonModalError('');
    setLessonModalOpen(true);
  };

  const handleCreateLesson = async () => {
    if (!canSave || !lessonModalUnitId) return;
    const trimmedTitle = lessonTitle.trim();
    if (!trimmedTitle) {
      setLessonModalError('Ingresá un título para la lección.');
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setLessonModalError('');

    const { data, error: rpcError } = await supabase.rpc(
      rpcNames.createLesson,
      {
        p_unit_id: lessonModalUnitId,
        p_title: trimmedTitle,
        p_lesson_type: lessonType,
        p_is_required: true,
      },
    );

    if (rpcError) {
      setLessonModalError(rpcError.message);
      setIsSaving(false);
      return;
    }

    if (data) {
      setLessonModalOpen(false);
      setIsSaving(false);
      router.push(`${courseBase}/lessons/${data}/edit`);
      return;
    }

    await refetchOutline();
    setLessonModalOpen(false);
    setIsSaving(false);
  };

  const handleReorderLessons = async (unitId: string, newOrder: string[]) => {
    if (!canSave) return;
    setIsSaving(true);
    setActionError(null);

    const { error: rpcError } = await supabase.rpc(rpcNames.reorderLessons, {
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
      rpcNames.createUnitQuiz,
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
      router.push(`${courseBase}/quizzes/${data}/edit`);
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
      rpcNames.createFinalQuiz,
      buildCourseArgs(courseId),
    );

    if (rpcError) {
      setActionError(rpcError.message);
      setIsSaving(false);
      return;
    }

    if (data) {
      router.push(`${courseBase}/quizzes/${data}/edit`);
    } else {
      await refetchOutline();
    }
    setIsSaving(false);
  };

  const handleEditLesson = (lessonId: string) => {
    if (!courseId) return;
    router.push(`${courseBase}/lessons/${lessonId}/edit`);
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="space-y-4">
          <nav className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href={backLink} className="font-semibold text-zinc-700">
              {backLabel}
            </Link>
            <span>/</span>
            <span>{row?.course_title ?? 'Outline'}</span>
          </nav>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs tracking-wide text-zinc-500 uppercase">
                  <span>Estructura del curso</span>
                  {isTemplate ? (
                    <span className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white">
                      TEMPLATE GLOBAL
                    </span>
                  ) : null}
                </div>
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
                {showPreview ? (
                  <Link
                    href={`${courseBase}/preview`}
                    className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                  >
                    Preview
                  </Link>
                ) : null}
                <Link
                  href={`${courseBase}/edit`}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  Editar curso
                </Link>
                {resolvedExtraActions}
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
              href={backLink}
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
              href={backLink}
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
                  onClick={openUnitModal}
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
                        onClick={() => openLessonModal(unit.unit_id)}
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
                            href={`${courseBase}/quizzes/${unit.unit_quiz.quiz_id}/edit`}
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
                      <div
                        key={lesson.lesson_id}
                        onClick={() => handleEditLesson(lesson.lesson_id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleEditLesson(lesson.lesson_id);
                          }
                        }}
                        className="flex w-full flex-col gap-2 rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-left text-sm text-zinc-700 transition hover:border-zinc-200 hover:bg-zinc-100 sm:flex-row sm:items-center sm:justify-between"
                        role="button"
                        tabIndex={0}
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
                      </div>
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
                    href={`${courseBase}/quizzes/${row.final_quiz.quiz_id}/edit`}
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

      {unitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                  Nueva unidad
                </p>
                <h2 className="mt-2 text-lg font-semibold text-zinc-900">
                  Crear unidad
                </h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                onClick={() => setUnitModalOpen(false)}
                disabled={isSaving}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-2">
              <label className="text-sm font-medium text-zinc-700">
                Título
              </label>
              <input
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                type="text"
                placeholder="Ej: Introducción"
                value={unitTitle}
                onChange={(event) => setUnitTitle(event.target.value)}
              />
            </div>

            {unitModalError && (
              <p className="mt-4 text-sm text-red-600">{unitModalError}</p>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                onClick={() => setUnitModalOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => void handleCreateUnit()}
                disabled={isSaving || !unitTitle.trim()}
              >
                {isSaving ? 'Creando…' : 'Crear unidad'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lessonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                  Nueva lección
                </p>
                <h2 className="mt-2 text-lg font-semibold text-zinc-900">
                  Crear lección
                </h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                onClick={() => setLessonModalOpen(false)}
                disabled={isSaving}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-2">
              <label className="text-sm font-medium text-zinc-700">
                Título
              </label>
              <input
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                type="text"
                placeholder="Ej: Introducción al curso"
                value={lessonTitle}
                onChange={(event) => setLessonTitle(event.target.value)}
              />
            </div>
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium text-zinc-700">
                Tipo de lección
              </label>
              <select
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                value={lessonType}
                onChange={(event) =>
                  setLessonType(event.target.value as LessonType)
                }
              >
                {allowedLessonTypes.map((type) => (
                  <option key={type} value={type}>
                    {lessonTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>

            <p className="mt-5 text-xs text-zinc-500">
              Podés agregar bloques y ajustar el contenido luego en el editor.
            </p>

            {lessonModalError && (
              <p className="mt-4 text-sm text-red-600">{lessonModalError}</p>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:border-zinc-300"
                onClick={() => setLessonModalOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => void handleCreateLesson()}
                disabled={isSaving || !lessonTitle.trim()}
              >
                {isSaving ? 'Creando…' : 'Crear lección'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
