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
