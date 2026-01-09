'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type QuizSummary = {
  quiz_id: string;
  title: string;
  questions_count: number;
  pass_score_pct: number;
};

type PreviewLesson = {
  lesson_id: string;
  title: string;
  lesson_type: string;
  position: number;
  estimated_minutes: number | null;
  is_required: boolean;
};

type PreviewUnit = {
  unit_id: string;
  title: string;
  position: number;
  lessons: PreviewLesson[];
  unit_quiz: QuizSummary | null;
};

type PreviewRow = {
  org_id: string;
  course_id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  units: PreviewUnit[];
  final_quiz: QuizSummary | null;
};

function statusLabel(status: PreviewRow['status']) {
  if (status === 'published') return 'Publicado';
  if (status === 'archived') return 'Archivado';
  return 'Borrador';
}

function statusClass(status: PreviewRow['status']) {
  if (status === 'published') return 'bg-emerald-100 text-emerald-700';
  if (status === 'archived') return 'bg-zinc-200 text-zinc-700';
  return 'bg-amber-100 text-amber-700';
}

export default function OrgCoursePreviewPage() {
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

  return <OrgCoursePreviewScreen courseId={courseId} basePath="/org/courses" />;
}

type CoursePreviewScreenProps = {
  courseId: string;
  basePath: string;
};

export function OrgCoursePreviewScreen({
  courseId,
  basePath,
}: CoursePreviewScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [row, setRow] = useState<PreviewRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!courseId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_org_course_preview')
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

      setRow((data as PreviewRow) ?? null);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const units = useMemo(() => row?.units ?? [], [row]);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <Link
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-700"
            href={`${basePath}/${courseId}/outline`}
          >
            ← Volver al outline
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Preview de curso
          </h1>
        </header>

        {loading && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="h-6 w-1/2 animate-pulse rounded bg-zinc-100" />
            <div className="mt-4 h-24 animate-pulse rounded bg-zinc-100" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
          </div>
        )}

        {!loading && !error && !row && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              No tenés acceso a este curso o no existe.
            </p>
          </div>
        )}

        {!loading && !error && row && (
          <>
            <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs tracking-wide text-zinc-500 uppercase">
                    Curso
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-zinc-900">
                    {row.title}
                  </h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                    row.status,
                  )}`}
                >
                  {statusLabel(row.status)}
                </span>
              </div>
              {row.description ? (
                <p className="text-sm text-zinc-600">{row.description}</p>
              ) : null}
              {row.final_quiz ? (
                <div className="rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-600">
                  Evaluación final: {row.final_quiz.title} (
                  {row.final_quiz.questions_count} preguntas)
                </div>
              ) : null}
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-zinc-900">
                Unidades y lecciones
              </h3>
              {units.length === 0 ? (
                <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
                  Este curso todavía no tiene unidades.
                </div>
              ) : (
                units.map((unit) => (
                  <div
                    key={unit.unit_id}
                    className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-900">
                        {unit.title}
                      </p>
                      <span className="text-xs text-zinc-500">
                        Unidad {unit.position}
                      </span>
                    </div>
                    {unit.unit_quiz ? (
                      <div className="rounded-xl border border-zinc-200 px-4 py-2 text-xs text-zinc-600">
                        Quiz de unidad: {unit.unit_quiz.title} (
                        {unit.unit_quiz.questions_count} preguntas)
                      </div>
                    ) : null}
                    {unit.lessons.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        Sin lecciones aún.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {unit.lessons.map((lesson) => (
                          <div
                            key={lesson.lesson_id}
                            className="flex items-center justify-between rounded-xl border border-zinc-100 px-4 py-2 text-sm"
                          >
                            <div>
                              <p className="font-medium text-zinc-900">
                                {lesson.title}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {lesson.lesson_type} • Posición{' '}
                                {lesson.position}
                              </p>
                            </div>
                            <span className="text-xs text-zinc-500">
                              {lesson.estimated_minutes
                                ? `${lesson.estimated_minutes} min`
                                : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
