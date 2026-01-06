'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type CourseItem = {
  course_id: string;
  course_title: string;
  course_status: 'pending' | 'in_progress' | 'completed';
  completion_percent: number;
  completed_lessons: number;
  total_lessons: number;
  last_activity_at: string | null;
};

type ActivityItem = {
  occurred_at: string;
  event_type: 'lesson_completed' | 'quiz_submitted';
  label: string;
  course_id: string;
  course_title: string;
  unit_id: string | null;
  unit_title: string | null;
  quiz_id: string | null;
  quiz_title: string | null;
};

type IncorrectQuestion = {
  question_id: string;
  position: number;
  prompt: string;
  selected_option_id: string | null;
  selected_option_text: string | null;
  correct_option_id: string | null;
  correct_option_text: string | null;
};

type QuizItem = {
  quiz_id: string;
  quiz_title: string;
  quiz_scope: 'unit' | 'course';
  course_id: string;
  unit_id: string | null;
  last_attempt_id: string | null;
  last_attempt_no: number | null;
  last_submitted_at: string | null;
  last_score: number | null;
  last_passed: boolean | null;
  total_questions: number;
  incorrect_count: number;
  incorrect_questions: IncorrectQuestion[];
};

type LearnerDetailRow = {
  local_id: string;
  local_name: string;
  learner_id: string;
  learner_name: string;
  learner_email: string;
  membership_status: string;
  membership_created_at: string;
  learner_state: 'active' | 'inactive' | 'graduated';
  risk_level: 'none' | 'warning' | 'danger';
  last_activity_at: string | null;
  days_inactive: number | null;
  completion_percent: number;
  avg_score: number | null;
  courses: CourseItem[];
  recent_activity: ActivityItem[];
  quizzes: QuizItem[];
};

function formatTimestamp(value: string | null) {
  if (!value) return 'Sin actividad reciente';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin actividad reciente';
  return date.toLocaleString();
}

function learnerStateLabel(state: LearnerDetailRow['learner_state']) {
  if (state === 'graduated') return 'Graduado';
  if (state === 'inactive') return 'Inactivo';
  return 'Activo';
}

function learnerStateClass(state: LearnerDetailRow['learner_state']) {
  if (state === 'graduated') return 'bg-emerald-100 text-emerald-700';
  if (state === 'inactive') return 'bg-zinc-200 text-zinc-700';
  return 'bg-zinc-100 text-zinc-700';
}

function riskLabel(risk: LearnerDetailRow['risk_level']) {
  if (risk === 'danger') return 'Riesgo';
  if (risk === 'warning') return 'Atención';
  return '';
}

function riskClass(risk: LearnerDetailRow['risk_level']) {
  if (risk === 'danger') return 'bg-red-100 text-red-700';
  if (risk === 'warning') return 'bg-amber-100 text-amber-700';
  return '';
}

export default function RefLearnerDetailPage() {
  const params = useParams();
  const localId = params?.localId as string;
  const learnerId = params?.learnerId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [row, setRow] = useState<LearnerDetailRow | null>(null);

  const fetchDetail = async () => {
    if (!localId || !learnerId) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('v_ref_learner_detail')
      .select('*')
      .eq('local_id', localId)
      .eq('learner_id', learnerId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        setRow(null);
        setLoading(false);
        return;
      }
      setError(fetchError.message);
      setRow(null);
      setLoading(false);
      return;
    }

    setRow(data as LearnerDetailRow);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localId || !learnerId) return;
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('v_ref_learner_detail')
        .select('*')
        .eq('local_id', localId)
        .eq('learner_id', learnerId)
        .single();

      if (cancelled) return;

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setRow(null);
          setLoading(false);
          return;
        }
        setError(fetchError.message);
        setRow(null);
        setLoading(false);
        return;
      }

      setRow(data as LearnerDetailRow);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [learnerId, localId]);

  const courses = useMemo(() => row?.courses ?? [], [row]);
  const quizzes = useMemo(() => row?.quizzes ?? [], [row]);
  const recentActivity = useMemo(() => row?.recent_activity ?? [], [row]);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4">
          <p className="text-xs tracking-wide text-zinc-500 uppercase">
            Detalle del aprendiz
          </p>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900">
                  {row?.learner_name ?? 'Aprendiz'}
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  {row?.learner_email ?? 'Sin email'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {row && (
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${learnerStateClass(
                      row.learner_state,
                    )}`}
                  >
                    {learnerStateLabel(row.learner_state)}
                  </span>
                )}
                {row && row.risk_level !== 'none' && (
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${riskClass(
                      row.risk_level,
                    )}`}
                  >
                    {riskLabel(row.risk_level)}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm text-zinc-500">
              <p>
                Última actividad:{' '}
                {formatTimestamp(row?.last_activity_at ?? null)}
              </p>
              {row?.avg_score != null && (
                <p>Score promedio: {row.avg_score.toFixed(1)}</p>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Progreso total</span>
                <span>{row?.completion_percent ?? 0}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-zinc-100">
                <div
                  className="h-2 rounded-full bg-zinc-900"
                  style={{ width: `${row?.completion_percent ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        </header>

        {loading && (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-28 animate-pulse rounded-2xl bg-white p-5 shadow-sm"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Error: {error}</p>
            <button
              className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300"
              onClick={fetchDetail}
              type="button"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && !row && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">
              No hay datos para este aprendiz.
            </p>
          </div>
        )}

        {!loading && !error && row && (
          <>
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900">Cursos</h2>
              <div className="mt-4 space-y-4">
                {courses.length === 0 && (
                  <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                    No hay cursos asignados.
                  </div>
                )}
                {courses.map((course) => (
                  <div
                    key={course.course_id}
                    className="rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {course.course_title}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {course.course_status === 'completed'
                            ? 'Completado'
                            : course.course_status === 'pending'
                              ? 'Pendiente'
                              : 'En progreso'}
                        </p>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {course.completed_lessons}/{course.total_lessons}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>Progreso</span>
                        <span>{course.completion_percent}%</span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-zinc-100">
                        <div
                          className="h-2 rounded-full bg-zinc-900"
                          style={{ width: `${course.completion_percent}%` }}
                        />
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-zinc-500">
                      Última actividad:{' '}
                      {formatTimestamp(course.last_activity_at)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900">Quizzes</h2>
              <div className="mt-4 space-y-4">
                {quizzes.length === 0 && (
                  <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                    No hay quizzes enviados.
                  </div>
                )}
                {quizzes.map((quiz) => (
                  <details
                    key={quiz.quiz_id}
                    className="rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">
                            {quiz.quiz_title}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {quiz.quiz_scope === 'unit' ? 'Unidad' : 'Curso'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                          {quiz.last_score != null && (
                            <span>Score: {quiz.last_score}</span>
                          )}
                          {quiz.last_passed != null && (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                quiz.last_passed
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {quiz.last_passed ? 'Aprobado' : 'No aprobado'}
                            </span>
                          )}
                          <span>Incorrectas: {quiz.incorrect_count}</span>
                        </div>
                      </div>
                    </summary>

                    <div className="mt-4 space-y-3">
                      {quiz.incorrect_questions.length === 0 && (
                        <p className="text-xs text-zinc-500">
                          No hay respuestas incorrectas registradas.
                        </p>
                      )}
                      {quiz.incorrect_questions.map((question) => (
                        <div
                          key={question.question_id}
                          className="rounded-xl border border-zinc-200 p-4"
                        >
                          <p className="text-sm font-semibold text-zinc-900">
                            {question.prompt}
                          </p>
                          <p className="mt-2 text-xs text-red-600">
                            Respuesta:{' '}
                            {question.selected_option_text ?? 'Sin respuesta'}
                          </p>
                          <p className="mt-1 text-xs text-emerald-600">
                            Correcta: {question.correct_option_text ?? 'N/D'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900">
                Actividad reciente
              </h2>
              <div className="mt-4 space-y-3">
                {recentActivity.length === 0 && (
                  <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm">
                    Sin actividad reciente.
                  </div>
                )}
                {recentActivity.map((activity, index) => (
                  <div
                    key={`${activity.course_id}-${index}`}
                    className="rounded-2xl bg-white p-4 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-zinc-900">
                      {activity.label}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {activity.course_title}
                      {activity.unit_title ? ` · ${activity.unit_title}` : ''}
                      {activity.quiz_title ? ` · ${activity.quiz_title}` : ''}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {formatTimestamp(activity.occurred_at)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
