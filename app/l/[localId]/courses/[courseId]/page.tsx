'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/learner/Card';
import { LearnerShell } from '@/components/learner/LearnerShell';
import { PageHeader } from '@/components/learner/PageHeader';
import { StateBlock } from '@/components/learner/StateBlock';
import { formatStatusLabel } from '@/lib/learner/formatters';

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
    <LearnerShell maxWidthClass="max-w-4xl">
      <PageHeader label="Curso" title={courseTitle} />

      {!loading && rows.length > 0 && (
        <div className="mt-6 space-y-4">
          <Card className="p-5">
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
          </Card>

          <button
            className="w-full rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            type="button"
            onClick={handleContinue}
            disabled={!nextLessonId}
          >
            Continuar
          </button>
        </div>
      )}

      {loading && (
        <div className="mt-8 space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={`skeleton-${index}`} className="h-24 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mt-8">
          <StateBlock
            tone="error"
            title="No pudimos cargar la información."
            description={`Error: ${error}`}
            actions={
              <>
                <button
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
                  onClick={fetchOutline}
                  type="button"
                >
                  Reintentar
                </button>
                <button
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
                  onClick={() => router.back()}
                  type="button"
                >
                  Volver
                </button>
              </>
            }
          />
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="mt-8">
          <StateBlock
            tone="empty"
            title="Este curso no está disponible."
            description="Todavía no tiene contenido publicado para tu local."
            actions={
              <button
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
                onClick={() => router.back()}
                type="button"
              >
                Volver
              </button>
            }
          />
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="mt-8 space-y-6">
          {groupedUnits.map((unit) => (
            <Card key={unit.unit_id} className="p-5">
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
                      Hacer evaluación
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
                        router.push(`/l/${localId}/lessons/${lesson.lesson_id}`)
                      }
                      type="button"
                    >
                      <span>{lesson.lesson_title}</span>
                      <span className="text-xs text-zinc-500">
                        {formatStatusLabel(lesson.lesson_status)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          {courseQuizId && (
            <button
              className="w-full rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-800 hover:border-zinc-300"
              type="button"
              onClick={() =>
                router.push(`/l/${localId}/quizzes/${courseQuizId}`)
              }
            >
              Evaluación final del curso
            </button>
          )}
        </div>
      )}
    </LearnerShell>
  );
}
